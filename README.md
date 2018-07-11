# DoubleClick Campaign Manager WDC [![Build Status](https://travis-ci.org/tableau-mkt/dcm-dfa-wdc.svg?branch=master)](https://travis-ci.org/tableau-mkt/dcm-dfa-wdc)

### Running this WDC
As a convenience, we provide a [hosted version of this WDC](https://dcm-dfa-wdc.herokuapp.com/) for testing and validation purposes. If you plan to use this connector for production workloads, we recommend hosting the web data connector on your own systems.

You will need to do the following:

- Make sure you have [Node.js](https://nodejs.org/en/) and [grunt](http://gruntjs.com/getting-started#installing-the-cli)
  installed.
- [Register an application with Google](https://developers.google.com/identity/protocols/OAuth2WebServer#creatingcred)
  - Set up your client's Redirect URL(s) to include http://localhost:9001 (or whatever host/port you will be running on)
  - Note the Client ID and Client Secret for your application.
- Clone this repository's code locally and run:
  - `npm install`
  - `grunt build`
- Set some environment variables (instructions may differ per hosting provider):
```sh
export GCLIENT_ID='Your Google App Client ID Here'
export GCLIENT_SECRET='Your Google App Client Secret Here'
export GREDIRECT_URL='http://localhost:9001' # or the URL where your copy of the WDC can be accessed
export PORT='9001' # or the poart that your app will respond on
```
- Then run `npm start`, which will make your app available at http://localhost:9001
