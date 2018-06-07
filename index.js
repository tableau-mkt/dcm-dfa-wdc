// Generated on 2016-01-21 using generator-web-data-connector 1.0.1

var express = require('express'),
    request = require('request'),
    bodyParser = require('body-parser'),
    google = require('googleapis'),
    OAuth2 = google.auth.OAuth2,
    gclient_id = process.env.GCLIENT_ID || 'set GCLIENT_ID var',
    gclient_secret = process.env.GCLIENT_SECRET || 'set GCLIENT_SECRET var',
    gredirect_url = process.env.GREDIRECT_URL || 'http://localhost:9001',
    oauth2client = new OAuth2(gclient_id, gclient_secret, gredirect_url),
    es = require('event-stream'),
    csv = require('csv'),
    app = express(),
    port = process.env.PORT || 9001;


// Serve files as if this were a static file server.
app.use(express.static('./'));

// Parse JSON encoded POSTs from our app.
app.use(bodyParser.json());

// Proxy the index.html file.
app.get('/', function (req, res) {
  res.sendFile('./index.html');
});

// A redirect to initialize Google oauth flow.
app.get('/authorize', function (req, res) {
  var scopes = [
        'https://www.googleapis.com/auth/dfareporting',
        'https://www.googleapis.com/auth/dfatrafficking'
      ],
      redirectTo;

  console.log('Authorization attempt received.');

  // Get the OAuth 2.0 redirect URL, and perform the redirect.
  redirectTo = oauth2client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes
  });

  console.log('Redirecting the user.');

  // Appending prompt ensures we get a refresh token from Google every time.
  res.redirect(redirectTo + '&prompt=consent');
});

app.post('/tokenize', function (req, res) {
  console.log('Token request received.');

  oauth2client.getToken(req.body.code, function(err, tokens) {
    if (!err) {
      console.log('Responding with token data.');

      // If Google responded favorably, return the auth and refresh tokens.
      res.set('Content-type', 'application/json');
      res.set('Connection', 'close');
      res.send(tokens);
      res.end();
    }
    else {
      console.error('There was a problem requesting token data.');
      console.error(err);
      res.set('Connection', 'close');
      res.sendStatus(500);
      res.end();
    }
  });
});

app.post('/reports', function (req, res) {
  var dfaReporting;

  oauth2client.setCredentials(req.body);
  google.options({auth: oauth2client});
  dfaReporting = google.dfareporting('v2.8');

  console.log('Reports request received.');

  dfaReporting.userProfiles.list(null, function (err, profiles) {
    if (profiles && profiles.items && profiles.items.length) {
      dfaReporting.reports.list({profileId: profiles.items[0].profileId, scope: 'ALL'}, function (err, reports) {
        if (!err) {
          // Add the profileID to the response so the WDC can track it.
          reports.profileId = profiles.items[0].profileId;

          // Filter out all reports that are not in CSV format.
          reports.items = reports.items.filter(function (value) {
            return value.format && value.format === 'CSV';
          });

          console.log('Responding with reports data.');
          res.set('Content-type', 'application/json');
          res.set('Connection', 'close');
          res.send(reports);
          res.end();
        }
        else {
          console.error('There was a problem requesting reports data.');
          console.error(err);
          res.set('Connection', 'close');
          res.sendStatus(500);
          res.end();
        }
      });
    }
    else {
      console.log('There was a problem requesting reports data.');
      console.error(err);
      res.set('Connection', 'close');
      res.sendStatus(500);
      res.end();
    }
  });
});

app.post('/headers', function (req, res) {
  console.log('Headers request received.');

  app._getColumns({
    profileId: req.body.profileId,
    reportId: req.body.reportId,
    auth: req.body.auth
  }, function (err, columns) {
    if (!err) {
      console.log('Sending column header data.');
      res.set('Content-type', 'application/json');
      res.set('Connection', 'close');
      res.send(columns);
      res.end();
    }
    else {
      console.error('There was a problem requesting headers data.');
      console.error(err);
      res.set('Connection', 'close');
      res.sendStatus(500);
      res.end();
    }
  });
});

app.post('/data', function (req, res) {
  console.log('Attempting to pull report data.');
  app._getColumns({
    profileId: req.body.profileId,
    reportId: req.body.reportId,
    auth: req.body.auth
  }, function (err, columns) {
    var dfaReporting;

    if (!err) {
      console.log('Found report schema details.');

      oauth2client.setCredentials(req.body.auth);
      google.options({auth: oauth2client});
      dfaReporting = google.dfareporting('v2.8');

      dfaReporting.reports.run({
        profileId: req.body.profileId,
        reportId: req.body.reportId,
        synchronous: true
      }, function (err, file) {
        var processedData = [],
            processedRow;

        if (!err && file.id) {
          console.log('Successfully ran report.');
          dfaReporting.files.get({
            reportId: req.body.reportId,
            fileId: file.id,
            alt: 'media'
          }).on('end', function () {
            // The first row will always be headers. Remove, then return.
            processedData.shift();
            res.set('Content-type', 'application/json');
            res.set('Connection', 'close');
            res.send(processedData);
            res.end();
          }).pipe(es.split())
            .pipe(es.mapSync(function (line) {
              csv.parse(line, {delimiter: ','}, function (err, data) {
                if (data && data[0] && data[0].length === columns.length && data[0][0] !== 'Grand Total:') {
                  processedRow = {};
                  columns.forEach(function(value, index) {
                    processedRow[value.name] = data[0][index];
                  })
                  processedData.push(processedRow);
                }
              });
            }));
        }
        else {
          console.error('There was a problem running the report.');
          console.error(err);
          res.set('Connection', 'close');
          res.sendStatus(500);
          res.end();
        }
      });
    }
    else {
      console.log('There was a problem pulling report schema.');
      res.set('Connection', 'close');
      res.sendStatus(500);
      res.end();
    }
  });
});

app._getColumns = function getColumns(opts, callback) {
  var dfaReporting;

  oauth2client.setCredentials(opts.auth);
  google.options({auth: oauth2client});
  dfaReporting = google.dfareporting('v2.8');

  dfaReporting.reports.get({
    profileId: opts.profileId,
    reportId: opts.reportId,
    fields: 'accountId,criteria,crossDimensionReachCriteria,delivery,etag,fileName,floodlightCriteria,format,id,kind,lastModifiedTime,name,ownerProfileId,pathToConversionCriteria,reachCriteria,schedule,subAccountId,type'
  }, function (err, report) {
    var response = [];

    if (!err) {
      report.criteria.dimensions.forEach(function(dimension) {
        response.push({
          name: dimension.name.replace('dfa:', ''),
          type: dimension.name === 'dfa:date' ? 'date' : 'string'
        });
      });
      report.criteria.metricNames.forEach(function(metric) {
        response.push({
          name: metric.replace('dfa:', ''),
          type: 'int'
        });
      });
      if (report.criteria.activities && report.criteria.activities.metricNames) {
        report.criteria.activities.metricNames.forEach(function (metric) {
          response.push({
            name: metric.replace('dfa:', ''),
            type: 'int'
          });
        });
      }
      if (report.criteria.activities && report.criteria.activities.filters) {
        report.criteria.activities.filters.forEach(function (dimension) {
          response.push({
            name: dimension.dimensionName.replace('dfa:', '') + ':' + dimension.id,
            type: 'int'
          });
        });
      }
      callback(err, response);
    }
    else {
      callback(err, []);
    }
  });
}

var server = app.listen(port, function () {
  var port = server.address().port;
  console.log('Express server listening on port ' + port);
});

module.exports = app;
