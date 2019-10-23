/**
 * Module dependencies.
 */
var express = require("express");
var path = require("path");
var fs = require("fs");
var favicon = require("serve-favicon");
var bodyParser = require("body-parser");
var morgan = require("morgan");
var errorhandler = require("errorhandler");
var cors = require("cors");

//var routes = require("./routes");
//var user = require("./routes/user");
var httpStatManager = require("./routes/httpStatManager");
var rbusStatManager = require("./routes/rbusStatManager");
var http = require("http");
var assert = require("assert");
var MongoClient = require("mongodb").MongoClient;

// aggregazione Statistiche
var collectStatHTTP = require("./routes/collectStatHTTP");

var globaljs = require("./routes/global");
var app = express();

// all environments
app.set("views", __dirname + "/views");

app.use(favicon(path.join(__dirname, "public/images", "favicon.png")));

// HTTP LOGGER
var logPath = path.join(__dirname, "logs");

if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath);
}

var accessLogStream = fs.createWriteStream(logPath + "/HTTPMonitor.log", {
  flags: "a"
});
app.use(
  morgan(
    ":date :res[content-length] :remote-addr :method :url - RC: :status :response-time ms",
    {
      stream: accessLogStream
    }
  )
);

// development only
if ("development" === app.get("env")) {
  app.use(errorhandler());
}

// Servizi

var jsonParser = bodyParser.json();
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});

/**
 * Define all routes
 * @param {*} guiServer
 * @param {*} port
 */
function defineRoute(guiServer, port) {
  app.use(
    cors({
      origin: guiServer
    })
  );
  app.set("port", port);
  app.get("/rest/distinctApplication", httpStatManager.GetDistinctApplication);

  app.get("/rest/getHTTPStatistics", httpStatManager.GetHTTPStatistics);

  app.get("/rest/getRBUSStatistics", rbusStatManager.GetRBUSStatistics);

  app.get(
    "/rest/getRBUSCurrentPerformaceStatistics",
    rbusStatManager.GetRBUSCurrentPerformaceStatistics
  );
  app.get(
    "/rest/getHTTPCurrentPerformaceStatistics",
    httpStatManager.GetHTTPCurrentPerformaceStatistics
  );

  app.get("/rest/cleanHTTPLog", httpStatManager.CleanHTTPLog);

  app.get("/rest/collectRBUS", collectStatHTTP.CollectRBUS);

  // POST
  app.post("/rest/deleteAll", jsonParser, httpStatManager.DeleteAll);
}

console.log("Start conencting to .. " + globaljs.urlDB);
console.log("Working directory is " + __dirname);

//var client = new MongoClient();
// var httpDBMo;

/**
 * Manage timer for Statistics aggregation function
 * @param {*} httpDBMo
 */
function refreshHTTPData(httpDBMo) {
  console.log("REFRESH HTTP DATA called .." + new Date());
  paramHTTP = {
    interval: globaljs.options.intervalHTTP,
    timeout: globaljs.options.timeoutHTTP,
    callback: refreshHTTPData
  };
  collectStatHTTP.StatHTTP(paramHTTP, httpDBMo);
}

/**
 * Manage timer for Statistics aggregation function
 * @param {*} httpDBMo
 */
function refreshRBUSData(httpDBMo) {
  console.log("REFRESH RBUS DATA called .." + new Date());
  paramRBUS = {
    interval: globaljs.options.intervalRBUS,
    timeout: globaljs.options.timeoutRBUS,
    callback: refreshRBUSData
  };
  collectStatHTTP.StatRBUS(paramRBUS, httpDBMo);
}

/**
 * Manage timer for log management (clean old data)
 * @param {*} firstTime
 */
function manageHTTPLogCleaning(firstTime) {
  var diff = 1000 * 60 * 60 * 24;
  var now = new Date().getTime();
  if (firstTime) {
    // start a l'una di notte
    // aggiungo un giorno
    var tomorrow = new Date(now + 1000 * 60 * 60 * 24);
    tomorrow.setHours(1);
    tomorrow.setMinutes(0);
    tomorrow.setSeconds(0);
    tomorrow.setMilliseconds(0);
    var diff = tomorrow.getTime() - now;
    console.log(
      "Now : " + new Date() + " - Schedul time " + tomorrow + " DIFF : " + diff
    );
  }
  httpStatManager.CleanHTTPLogInternal(2, "HTTP");
  httpStatManager.CleanHTTPLogInternal(2, "RBUS");
  httpStatManager.CleanHTTPLogInternal(15, "STAT");
  console.log("Schedule cleaning af HTTP log db at " + new Date(now + diff));
  setTimeout(manageHTTPLogCleaning, diff);
}

/**
 * Main
 * @param {*} httpDBMo
 */
function mainTask(httpDBMo) {
  var option = globaljs.options;
  console.log("MAIN Final options " + JSON.stringify(option));
  if (!option.onlyServer) {
    // recupera log da gestire
    if (option.filesToTail)
      for (var index = 0; index < option.filesToTail.length; index++) {
        var entry = option.filesToTail[index];
        try {
          if (entry.id && entry.path)
            require("./routes/tailLog")(entry.id, httpDBMo, entry.path);
        } catch (error) {
          console.log("Errore in TAIL file " + entry.key.path + " : " + err);
        }
      }
    // Start collecting statistics
    if (!option.onlyTail) {
      console.log("Start Timer to create agregated HTTP data");
      setTimeout(refreshHTTPData, 5000, httpDBMo);
      console.log("Start Timer to create agregated RBUS data");
      setTimeout(refreshRBUSData, 10000, httpDBMo);
    }
  }
  if (!option.onlyServer) manageHTTPLogCleaning("true");
  // Start HTTP Server
  http.createServer(app).listen(app.get("port"), function() {
    console.log("Express server listening on port " + app.get("port"));
  });
}
// Use connect method to connect to the Server

var connectFunc = function(err, db) {
  assert.equal(null, err);
  console.log("Connected successfully to server : " + globaljs.options.urlDB);
  globaljs.mongoCon = db.db(globaljs.DBName);
  mainTask(globaljs.mongoCon);
};
var connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

var configFileName = __dirname + "/httpMonitor.json";
console.log("Lettura configurazione da " + configFileName);
// read options
fs.readFile(configFileName, (err, data) => {
  var port = process.env.PORT || globaljs.SERVER_PORT;

  var guiServer = "http://localhost:8080";

  if (err) console.log("Errore in lettura di " + configFileName + " : " + err);
  else {
    var option = JSON.parse(data.toString());
    console.log("Input Options " + JSON.stringify(option));
    if (option.urlDB) globaljs.options.urlDB = option.urlDB;
    if (typeof option.onlyServer !== "undefined")
      globaljs.options.onlyServer = option.onlyServer;
    if (typeof option.onlyTail !== "undefined")
      globaljs.options.onlyTail = option.onlyTail;
    if (typeof option.intervalHTTP !== "undefined")
      globaljs.options.intervalHTTP = option.intervalHTTP;
    if (typeof option.timeoutHTTP !== "undefined")
      globaljs.options.timeoutHTTP = option.timeoutHTTP;
    if (typeof option.intervalRBUS !== "undefined")
      globaljs.options.intervalRBUS = option.intervalRBUS;
    if (typeof option.timeoutRBUS !== "undefined")
      globaljs.options.timeoutRBUS = option.timeoutRBUS;
    if (option.filesToTail) globaljs.options.filesToTail = option.filesToTail;
    // override server info
    if (option.guiServer) guiServer = option.guiServer;
    if (option.port) port = option.port;
  }

  defineRoute(guiServer, port);
  console.log("Final options " + JSON.stringify(globaljs.options));
  // Connect to DB
  var url = "mongodb://" + globaljs.options.urlDB;
  MongoClient.connect(url, connectOptions, connectFunc);
});
