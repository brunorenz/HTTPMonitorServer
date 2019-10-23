/**
 * Module dependencies.
 */

var express = require('express'); 
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var assert = require('assert');
var mongoClient = require('mongodb').MongoClient;
//var pug = require('pug');
var collectStatHTTP = require('./routes/collectStatHTTP');

var globaljs  = require('./routes/global');
var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

//
// var HTTPKEY = 1;
// DB COnnect
console.log("START..."+globaljs.urlDB);
// var url = 'localhost:27017/HTTPLog';
// var httpDB = monk(globaljs.urlDB);
// httpDB.then(() => {
// console.log('Connected correctly to server')
// });
// var httpEntry = httpDB.get('httpLog');
// var configEntry = httpDB.get('httpLogConfig');

// var httpDBMo;
var mongoClient = require('mongodb').MongoClient;
var httpDBMo;
mongoClient.connect("mongodb://"+globaljs.urlDB+"?maxPoolSize=10",function(err,database)
  	{
  	  console.log("MONGO DB     : "+database);
  	  if (err) return console.log("ERRORE in connessione MongoDB "+err);
  	  assert.equal(null, err);
  	httpDBMo = database;
  	  mainTask();
  	});

function mainTask()
{
  // Start log tail
  // require('./routes/tailLog')("HTTPAEM1",httpDBMo,globaljs.fced1);
  // require('./routes/tailLog')("HTTPAEM2",httpDBMo,globaljs.fced2);
  require('./routes/tailLog')("HTTPWAS1",httpDBMo,globaljs.fwas1);

  // Start collecting statistics
  setTimeout(refreshHTTPData, 10000,httpDBMo);
  // Start HTTP Server
  http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
	});
}


function refreshHTTPData(httpDBMo)
{
  console.log("REFRESH DATA called .."+(new Date()));
  collectStatHTTP.StatHTTP(globaljs.keyHTTP,httpDBMo);
  setTimeout(refreshHTTPData, 30000,httpDBMo);
}



app.get('/listUsers/:tipo/:minuti', function (req, res) {
  console.log("tipo : "+req.params.tipo);
  console.log("minuti : "+req.params.minuti);
  var r = collectStatHTTP.GetStatHTTP(res,req.params.tipo,httpDBMo,req.params.minuti);
})


