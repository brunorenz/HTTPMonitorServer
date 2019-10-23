var http = require("http");
var webSocket = require("ws");
var assert = require("assert");
var myutils = require("./myutils");
var globaljs = require("./global");
var httpUtils = require("./utils/httpUtils");
var aggregationUtils = require("./utils/aggregationUtils");

/**
 * Main function to retrieve the last available date and call the specific function for create accumulated statistics
 *
 * @param res
 * @param inputData
 * @returns
 */
function processLastRecord(res, inputData) {
  // valutare se prendere ultimo record di httpStat
  globaljs.mongoCon.collection(globaljs.collStat).findOne(
    {},
    {
      sort: {
        $natural: -1
      }
    },
    function(err, doc) {
      if (err) {
        console.log("ERRORE lettura ultimo record di log : " + err);
        res.json(httpUtils.createResponse(null, 500, err));
      } else {
        if (doc) {
          inputData.lst_exe = doc._id.time;
          // inputData.result = doc;
          if (inputData.time === "current") {
            inputData.query = {
              "_id.time": inputData.lst_exe
            };
            inputData.topDate = inputData.lst_exe;
            inputData.infDate = inputData.lst_exe;
          } else {
            // taglio ad interval
            var topDate = inputData.lst_exe;
            if (inputData.interval != 0)
              topDate = myutils.floorTime(inputData.interval, topDate);
            //TODO
            // tolgo 60 minuti
            var div = 1000 * 60 * 60;
            if (inputData.time === "day") div = 1000 * 60 * 60 * 24;
            //var infDate = new Date(inputData.lst_exe.getTime() - div);
            var infDate = new Date(topDate.getTime() - div);
            inputData.topDate = topDate;
            inputData.infDate = infDate;
            inputData.query = {
              $and: [
                {
                  "_id.time": {
                    $gte: infDate
                  }
                },
                {
                  "_id.time": {
                    $lt: topDate
                  }
                }
              ]
            };
          }
          console.log(
            "Call callBackFunction with " + JSON.stringify(inputData)
          );
          inputData.callBackFunction(res, inputData);
        } else
          res.json(
            httpUtils.createResponse(null, 100, "Nessun record trovato")
          );
      }
    }
  );
}

/**
 * Return last HTTP statistics
 * @param {*} res
 * @param {*} inputData
 */
function collectHTTPPerformanceStatistics(res, inputData) {
  var _finalize = function(key, value) {
    if (value.tot > 0) {
      value.elaOk = value.elaOk / value.tot;
      value.sizeOk = value.sizeOk / value.tot;
    }

    return value;
  };
  var _map = function() {
    var floorTimeSecond = function(interval, time) {
      var div = 1000 * interval;
      var l1 = time;
      var l2 = Math.floor(l1 / div) * div;
      return new Date(l2);
    };
    var out = {
      ok: 0,
      ko: 0,
      tot: 1,
      elaOk: 0,
      sizeOk: 0
    };
    var key = {
      server: this.server
      //time: floorTimeSecond(1, this.tms_exe)
    };
    if (detail) key.time = floorTimeSecond(1, this.time);
    if (interval > 0) {
      key.time = floorTimeSecond(interval, this.time);
    }
    if (this.rc < 400) {
      out.ok = 1;
      out.elaOk = this.elapse;
      out.sizeOk = this.size;
    } else {
      out.ko = 1;
    }
    emit(key, out);
  };
  var _reduce = function(key, values) {
    var reduce = null;
    for (var index = 0; index < values.length; ++index) {
      var entry = values[index];

      //if (entry.tot > 1 || reduce === null) {
      if (reduce === null) {
        reduce = entry;
      } else {
        reduce.ok += entry.ok;
        reduce.ko += entry.ko;
        reduce.tot += entry.tot;
        reduce.elaOk += entry.elaOk;
        reduce.sizeOk += entry.sizeOk;
      }
    }
    return reduce;
  };

  var query = {
    $and: [
      {
        time: {
          $gte: inputData.fromTime
        }
      },
      {
        time: {
          $lt: inputData.toTime
        }
      }
    ]
  };
  console.log(
    "collectHTTPPerformanceStatistics start .. with " +
      JSON.stringify(inputData) +
      " .. Query : " +
      JSON.stringify(query)
  );
  globaljs.mongoCon.collection(globaljs.collLog).mapReduce(
    _map,
    _reduce,
    {
      query: query,
      out: {
        replace: "tempHTTPPerformanceResult"
      },
      scope: {
        interval: inputData.interval,
        detail: inputData.detail
      },
      finalize: _finalize
    },
    function(err, collection, stats) {
      if (err) {
        console.log(
          "ERROR in collectHTTPPerformanceStatistics mapReduce -  " + err
        );
        res.json(httpUtils.createResponse(null, 500, err));
      } else {
        collection.find({}).toArray(function(err, values) {
          var out = [];
          if (values) {
            console.log("Restituiti " + values.length + " record!");
            // pulisco
            for (var i = 0; i < values.length; i++) {
              var entry = {
                key: {
                  server: values[i]._id.server
                },
                value: values[i].value
              };
              if (values[i]._id.time) entry.key.time = values[i]._id.time;
              out.push(entry);
            }
          }
          var result = {
            configurazione: {
              infDate: inputData.fromTime,
              supDate: inputData.toTime,
              interval: inputData.interval
            },
            dati: out
          };
          res.json(httpUtils.createResponse(result));
        });
      }
    }
  );
}

/**
 * Collect runtime statisctics about RBUS servicecs response time
 * @param {*} res
 * @param {*} inputData
 */
function collectRBUSPerformanceStatistics(res, inputData) {
  var _createResultRBUS = function(err, collection, stats) {
    if (err) {
      console.log("ERROR in RBUSStatisticsResult mapReduce -  " + err);
      res.json(httpUtils.createResponse(null, 500, err));
    } else {
      var sort = inputData.avg ? { "value.elaOk": -1 } : { "value.tot": -1 };
      collection
        .find({})
        .sort(sort)
        .toArray(function(err, values) {
          found = function(array, entry) {
            for (index = 0; index < array.length; index++)
              if (array[index] === entry) return true;
            return false;
          };
          var out = [];
          var distServer = [];
          if (values) {
            console.log("Restituiti " + values.length + " record!");
            // pulisco
            for (var i = 0; i < values.length && i < inputData.depth; i++) {
              var entry = {
                key: {
                  server: values[i]._id.server
                },
                value: values[i].value
              };
              //if (values[i]._id.time) entry.key.time = values[i]._id.time;
              if (values[i]._id.service)
                entry.key.service = values[i]._id.service;
              if (!found(distServer, values[i]._id.server))
                distServer.push(values[i]._id.server);
              out.push(entry);
            }
          }
          var result = {
            configurazione: {
              infDate: inputData.fromTime,
              supDate: inputData.toTime,
              servers: distServer
            },
            dati: out
          };
          res.json(httpUtils.createResponse(result));
        });
    }
  };
  var _finalize = function(key, value) {
    if (value.tot > 0) {
      value.elaOk = value.elaOk / value.tot;
    }
    return value;
  };

  var _map = function() {
    var floorTimeSecond = function(interval, time) {
      var div = 1000 * interval;
      var l1 = time;
      var l2 = Math.floor(l1 / div) * div;
      return new Date(l2);
    };
    var out = {
      ok: 0,
      ko: 0,
      tot: 1,
      elaOk: 0
    };
    var key = {
      //server: this.serverName
    };
    let add = parent ? this.parent : true;
    if (add && onlyKo && this.ok) add = false;
    if (add) {
      if (!global) key.server = this.serverName;
      if (detail) key.time = floorTimeSecond(1, this.time);
      if (interval > 0) {
        key.time = floorTimeSecond(interval, this.time);
      }
      if (service) key.service = this.serviceName;
      if (this.ok) {
        out.elaOk = this.elapse;
        out.ok = 1;
      } else out.ko = 1;
      if (!this.serviceName.startsWith("JournalService")) emit(key, out);
    }

    // let add = parent ? this.parent : true;

    // if (add) {
    // }
  };

  var _reduce = function(key, values) {
    //print(">>> Key REDUCE ADD = " + tojson(key));
    var reduce = null;
    for (var index = 0; index < values.length; ++index) {
      var entry = values[index];
      //if (entry.tot > 1 || reduce === null) {
      if (reduce === null) {
        //print(">>> Key REDUCE ADD = " + tojson(entry) + " KEY " + tojson(key));
        reduce = entry;
      } else {
        reduce.ok += entry.ok;
        reduce.ko += entry.ko;
        reduce.tot += entry.tot;
        reduce.elaOk += entry.elaOk;
        //reduce.sizeOk += entry.sizeOk;
      }
      //print(">>> VALUE REDUCE ADD = " + tojson(entry));
    }
    return reduce;
  };
  var _mapDay = function() {
    var out = {
      parent: this.parent,
      total: this.total,
      ok: this.ok,
      ko: this.ko,
      elapse: this.elapse,
      elapseParent: this.elapseParent
    };
    var key = {};
    if (!global) key.server = this._id.serverName;
    if (service) key.service = this._id.serviceName;
    print(">>> Key REDUCE ADD = " + tojson(key));
    if (!this._id.serviceName.startsWith("JournalService")) emit(key, out);
  };

  var _reduceDay = function(key, values) {
    //print(">>> Key REDUCE ADD = " + tojson(key));
    var reduce = null;
    for (var index = 0; index < values.length; ++index) {
      var entry = values[index];
      if (reduce === null) {
        reduce = entry;
      } else {
        reduce.ok += entry.ok;
        reduce.ko += entry.ko;
        reduce.total += entry.total;
        reduce.parent += entry.parent;
        reduce.elapseParent += entry.elapseParent;
        reduce.elapse += entry.elapse;
      }
    }
    return reduce;
  };
  var _createResult = function(err, collection, stats) {
    if (err) {
      console.log("ERROR in _getGenericData mapReduce -  " + err);
      res.json(httpUtils.createResponse(null, 500, err));
    } else {
      collection.find({}).toArray(function(err, values) {
        found = function(array, entry) {
          for (index = 0; index < array.length; index++)
            if (array[index] === entry) return true;
          return false;
        };
        var out = [];
        var distServer = [];
        if (values) {
          console.log("Restituiti " + values.length + " record!");
          // pulisco
          for (var i = 0; i < values.length; i++) {
            var entry = {
              key: {
                server: values[i]._id.server
              },
              value: values[i].value
            };
            if (values[i]._id.time) entry.key.time = values[i]._id.time;
            if (inputData.service) entry.key.service = values[i]._id.service;
            if (!found(distServer, values[i]._id.server))
              distServer.push(values[i]._id.server);
            out.push(entry);
          }
        }
        var result = {
          configurazione: {
            infDate: inputData.fromTime,
            supDate: inputData.toTime,
            interval: inputData.interval,
            servers: distServer
          },
          dati: out
        };
        res.json(httpUtils.createResponse(result));
      });
    }
  };
  var query = {
    $and: [
      {
        time: {
          $gte: inputData.fromTime
        }
      },
      {
        time: {
          $lt: inputData.toTime
        }
      }
    ]
  };
  console.log(
    "collectRBUSPerformanceStatistics start .. with " +
      JSON.stringify(inputData) +
      " .. Query : " +
      JSON.stringify(query)
  );
  var tmpCollection = "tempPerformanceResult";
  var _createResultFunction = _createResult;
  if (inputData.resultCallBackFunction === "RBUS") {
    _createResultFunction = _createResultRBUS;
    tmpCollection = "tempPerformanceResultRBUS";
  }
  globaljs.mongoCon.collection(inputData.collection).mapReduce(
    inputData.current === 0 ? _mapDay : _map,
    inputData.current === 0 ? _reduceDay : _reduce,
    {
      query: query,
      out: {
        replace: tmpCollection
      },
      scope: {
        service: inputData.service,
        parent: inputData.parent,
        interval: inputData.interval,
        detail: inputData.detail,
        global: inputData.global,
        onlyKo: inputData.onlyKo,
        avg: inputData.avg
      },
      finalize: _finalize
    },
    _createResultFunction
  );
}
/**
 *
 * @param res
 * @param inputData
 * @returns
 */
function _getGenericData(res, inputData) {
  console.log("_getGenericData start .. with " + JSON.stringify(inputData));
  var getDataFinalize = function(key, value) {
    // check for single record
    //print(">>> FINALIZE OUTPUT (IN) = " + tojson(value));
    var out; // = [];
    if (value.values) out = value.values;
    else if (value.value) out = value.value;
    else out = value;

    if (out.okCount > 0) {
      out.avarageTime = out.totalTime / out.okCount;
      out.avarageSize = out.totalSize / out.okCount;
    } else {
      out.avarageTime = 0;
      out.avarageSize = 0;
    }
    if (out.redirectCount > 0) {
      out.avarageTimeRedirect = out.totalTimeRedirect / out.redirectCount;
    } else {
      out.avarageTimeRedirect = 0;
    }

    //print(">>> FINALIZE OUTPUT (OUT) = " + tojson(out));
    return out;
  };
  var getDataMap = function() {
    var key = {
      time: this._id.time,
      server: this._id.server
    };

    // interval management
    if (interval && interval > 0) {
      var div = 1000 * 60 * interval;
      var l1 = key.time.getTime();
      var l2 = Math.floor(l1 / div) * div;
      key.time = new Date(l2);
      //print("OLD Time : " + l1 + " - NEW Time " + l2);
    }
    // time.getTime()
    if (type === "app") {
      key.application = this._id.application;
    } else if (type === "method") {
      key.application = this._id.application;
      key.method = this._id.method;
    }
    var out = {
      //time: key.time.getTime(),
      okCount: this.value.okCount,
      totalTime: this.value.totalTime,
      totalSize: this.value.totalSize,
      redirectCount: this.value.redirectCount,
      totalTimeRedirect: this.value.totalTimeRedirect,
      clientErrorCount: this.value.clientErrorCount,
      serverErrorCount: this.value.serverErrorCount,
      notClassifiedCount: this.value.notClassifiedCount,
      num: this.value.num
    };
    emit(key, out);
  };
  var getDataReduce = function(key, values) {
    var reduce = {
      value: null
    };

    //print(">>> REDUCE " + values.length + " Records..");
    for (var index = 0; index < values.length; ++index) {
      var value = values[index];
      if (value.value) {
        //print(">>> Key REDUCE ADD = " + tojson(key));
        reduce.value = value.value;
      } else {
        if (reduce.value === null) {
          //print(">>> Key NEW = " + tojson(key));
          reduce.value = value;
        } else {
          //print(">>> Key REDUCE ADD = " + tojson(key));
          reduce.value.okCount += value.okCount;
          reduce.value.totalTime += value.totalTime;
          reduce.value.totalSize += value.totalSize;
          reduce.value.redirectCount += value.redirectCount;
          reduce.value.totalTimeRedirect += value.totalTimeRedirect;
          reduce.value.clientErrorCount += value.clientErrorCount;
          reduce.value.serverErrorCount += value.serverErrorCount;
          reduce.value.notClassifiedCount += value.notClassifiedCount;
          reduce.value.num += value.num;
        }
      }
    }

    return reduce;
  };

  globaljs.mongoCon.collection(inputData.httpCollection).mapReduce(
    getDataMap,
    getDataReduce,
    {
      query: inputData.query,
      out: {
        replace: "tempResult"
      },
      scope: {
        type: inputData.type,
        interval: inputData.interval
      },
      finalize: getDataFinalize
    },
    function(err, collection, stats) {
      if (err) {
        console.log("ERROR in _getGenericData mapReduce -  " + err);
        res.json(httpUtils.createResponse(null, 500, err));
      } else {
        collection.find({}).toArray(function(err, values) {
          found = function(array, entry) {
            for (index = 0; index < array.length; index++)
              if (array[index] === entry) return true;
            return false;
          };
          var out = [];
          var distServer = [];
          if (values) {
            console.log("Restituiti " + values.length + " record!");
            // pulisco
            for (var i = 0; i < values.length; i++) {
              var entry = {
                key: {
                  time: values[i]._id.time,
                  //timeL: values[i]._id.time.getTime(),
                  server: values[i]._id.server
                },
                value: values[i].value
              };
              if (!found(distServer, values[i]._id.server))
                distServer.push(values[i]._id.server);
              if (values[i]._id.application)
                entry.key.application = values[i]._id.application;
              out.push(entry);
            }
          }
          var result = {
            configurazione: {
              interval: inputData.interval,
              infDate: inputData.infDate,
              supDate: inputData.topDate,
              servers: distServer
            },
            dati: out
          };
          var emptyRecord = {
            okCount: 0,
            totalTime: 0,
            totalSize: 0,
            redirectCount: 0,
            totalTimeRedirect: 0,
            clientErrorCount: 0,
            serverErrorCount: 0,
            notClassifiedCount: 0,
            num: 0,
            avarageTime: 0,
            avarageSize: 0,
            avarageTimeRedirect: 0
          };
          //myutils.createGraphStructure(result, emptyRecord);
          res.json(httpUtils.createResponse(result));
        });
      }
    }
  );
}

/**
 * Process current statistics
 *
 * @param res
 * @param inputData
 * @returns
 */
function _getCurrentData(res, inputData) {
  console.log("_getCurrentData start ..");
  var query = {
    "_id.time": inputData.lst_exe
  };
  globaljs.mongoCon
    .collection(inputData.httpCollection)
    .find(query)
    .toArray(function(err, doc) {
      if (err) {
        console.log("ERRORE lettura data " + err);
        res.json(httpUtils.createResponse({}, 500, err));
      } else {
        var outL = [];
        var oneRecord;
        for (var i = 0; i < doc.length; i++) {
          var r = doc[i].value;
          if (inputData.type === "full") {
            if (i === 0) {
              oneRecord = {
                key: {
                  time: doc[i]._id.time,
                  server: doc[i]._id.server
                },
                value: doc[i].value
              };
            } else {
              oneRecord.value.okCount += doc[i].value.okCount;
              oneRecord.value.totalTime += doc[i].value.totalTime;
              oneRecord.value.totalSize += doc[i].value.totalSize;
              oneRecord.value.redirectCount += doc[i].value.redirectCount;
              oneRecord.value.totalTimeRedirect +=
                doc[i].value.totalTimeRedirect;
              oneRecord.value.clientErrorCount += doc[i].value.clientErrorCount;
              oneRecord.value.serverErrorCount += doc[i].value.serverErrorCount;
              oneRecord.value.notClassifiedCount +=
                doc[i].value.notClassifiedCount;
              oneRecord.value.num += doc[i].value.num;
            }
          } else {
            outL.push(doc[i]);
          }
        }
        if (oneRecord) {
          if (oneRecord.value.okCount > 0) {
            oneRecord.value.avarageTime =
              oneRecord.value.totalTime / oneRecord.value.okCount;
            oneRecord.value.avarageSize =
              oneRecord.value.totalSize / oneRecord.value.okCount;
          }
          if (oneRecord.value.redirectCount > 0) {
            oneRecord.value.avarageTimeRedirect =
              oneRecord.value.totalTimeRedirect / oneRecord.value.redirectCount;
          }
          outL.push(oneRecord);
        }
        res.json(httpUtils.createResponse(outL));
      }
    });
}

var getHTTPCurrentPerformaceStatistics = function(req, res) {
  const DEF_INTERVAL = 0;
  const DEF_DEPTH = 30; // 30 secondi
  const DEF_DETAIL = "true";
  if (!httpUtils.checkSecurity(req, res)) return;

  var interval = req.query.interval ? req.query.interval : DEF_INTERVAL;
  var timeDepth = req.query.timeDepth ? req.query.timeDepth : DEF_DEPTH;
  var detail = req.query.detail ? req.query.detail : DEF_DETAIL;
  var inputData = {
    interval: interval,
    timeDepth: timeDepth,
    detail: detail === "true",
    global: true,
    callBackFunction: collectHTTPPerformanceStatistics,
    key: globaljs.keyHTTP,
    collection: globaljs.collLog
  };
  aggregationUtils.getLastCollectionRecord(res, inputData);
};

/**
 *  Return HTTP server statistics according the input parameters
 */
var getHTTPStatistics = function(req, res) {
  const DEF_TYPE = "full";
  const DEF_TIME = "current";
  var DEF_INTERVAL = 1;
  if (!httpUtils.checkSecurity(req, res)) return;
  var type = req.query.type ? req.query.type : DEF_TYPE;
  var time = req.query.time ? req.query.time : DEF_TIME;
  if (type != "full" && type != "app" && type != "method") type = DEF_TYPE;
  if (time != "day" && time != "hour" && time != "current") time = DEF_TIME;
  if (time === "hour") DEF_INTERVAL = 5;
  else if (time === "day") DEF_INTERVAL = 30;
  var c = parseInt(req.query.interval);
  var interval = Number.isNaN(c) ? DEF_INTERVAL : c;

  console.log("getHTTPStatistics for type : " + type + " and time : " + time);
  // recupero ultimo aggiornamento
  var inputData = {
    type: type,
    time: time,
    interval: interval,
    httpCollection: globaljs.collStatFull,
    callBackFunction: _getGenericData
  };
  if (time === "day") {
    inputData.callBackFunction = _getGenericData;
  } else if (time === "hour") {
    inputData.callBackFunction = _getGenericData;
  } else {
    inputData.callBackFunction = _getGenericData;
  }
  if (type === "method") inputData.httpCollection = globaljs.collStat;
  processLastRecord(res, inputData);
};
/**
 * Return HTTP server statistics according the input parameters
 */
var getStatistics = function(req, res) {
  const DEF_TYPE = "full";
  const DEF_TIME = "current";
  const DEF_INTERVAL = 1;
  // tipo = full, app, method
  // day , hour , current
  if (!httpUtils.checkSecurity(req, res)) return;
  var type = req.params.type ? req.params.type : DEF_TYPE;
  var time = req.params.time ? req.params.time : DEF_TIME;
  var interval = req.params.intervall ? req.params.intervall : DEF_INTERVAL;
  if (type != "full" && type != "app" && type != "method") type = DEF_TYPE;
  if (time != "day" && time != "hour" && time != "current") time = DEF_TIME;
  console.log("getStatistics for type : " + type + " and time : " + time);
  // recupero ultimo aggiornamento
  var inputData = {
    type: type,
    time: time,
    interval: interval,
    httpCollection: globaljs.collStatFull,
    callBackFunction: _getGenericData
  };
  if (time === "day") {
    inputData.callBackFunction = _getGenericData;
  } else if (time === "hour") {
    inputData.callBackFunction = _getGenericData;
  } else {
    inputData.callBackFunction = _getGenericData;
  }
  if (type === "method") inputData.httpCollection = globaljs.collStat;
  processLastRecord(res, inputData);
};

/**
 * Return the distinct application with available statistics
 */
var distinctApplication = function(req, res) {
  if (!httpUtils.checkSecurity(req, res)) return;
  globaljs.mongoCon.collection("httpStatFull").distinct(
    "_id.application",
    {}, // query object
    function(err, docs) {
      if (err) {
        return console.log(err);
      }
      if (docs) {
        console.log(docs);
        res.json(httpUtils.createResponse(docs));
      }
    }
  );
};

var deleteAll = function(req, res) {
  if (!httpUtils.checkSecurity(req, res)) return;
  globaljs.mongoCon.collection("httpLogConfig").drop();
  globaljs.mongoCon.collection("httpStat").drop();
  globaljs.mongoCon.collection("httpStatFull").drop();
  res.json(httpUtils.createResponse());
};

/**
 * Clean rows of a colelction until a spacific date
 * @param {*} day
 * @param {*} db
 * @param {*} res
 */
var cleanHTTPLogInternal = function(day, db, res) {
  var now = new Date();
  var div = 1000 * 60 * 60 * 24 * day;
  var newDate = new Date(now.getTime() - div);
  newDate.setMilliseconds(0);
  newDate.setSeconds(0);
  newDate.setMinutes(0);
  newDate.setHours(0);
  switch (db) {
    case "RBUS":
      var query = {
        time: {
          $lt: newDate
        }
      };
      deleteCollection(newDate, globaljs.collRBUS, query, res);
      break;
    case "STAT":
      var query = {
        "_id.time": {
          $lt: newDate
        }
      };
      deleteCollection(newDate, globaljs.collStat, query);
      deleteCollection(newDate, globaljs.collStatFull, query);
      deleteCollection(newDate, globaljs.collStatRbus, query);
      if (res) res.json(httpUtils.createResponse());
      break;
    case "HTTP":
    default:
      var query = {
        time: {
          $lt: newDate
        }
      };
      deleteCollection(newDate, globaljs.collLog, query, res);
      break;
  }
};

var cleanHTTPLog = function(req, res) {
  if (!httpUtils.checkSecurity(req, res)) return;
  let DAY = 2;
  let DB = "HTTP";
  //let collection = globaljs.collLog;
  var db = req.query.db ? req.query.db : DB;
  if (db === "STAT") DAY = 30;
  var day = req.query.day ? Number.parseInt(req.query.day) : DAY;
  if (!Number.isInteger(day)) day = DAY;
  cleanHTTPLogInternal(day, db, res);
};

function deleteCollection(newDate, collection, filter, res) {
  console.log(
    "delete records up to " + newDate + " for  collection " + collection
  );
  globaljs.mongoCon
    .collection(collection)
    .deleteMany(filter, function(err, docs) {
      if (err) {
        console.error(
          "Error during remove rows from " + collection + " : " + err
        );
        if (res) res.json(httpUtils.createResponse(null, 500, err));
      } else {
        console.log(docs.result.n + " Record(s) deleted successfully");
        if (res) res.json(httpUtils.createResponse());
      }
    });
}

/**
 * Get last tms_exe in the httpLog
 * @param {*} res
 * @param {*} inputData
 */
function getLastHttpLogTms(res, inputData) {
  globaljs.mongoCon.collection(inputData.collection).findOne(
    {},
    {
      sort: {
        $natural: -1
      }
    },
    function(err, doc) {
      if (err) {
        console.log("ERRORE lettura " + inputData.collection + " : " + err);
        res.json(httpUtils.createResponse(null, 500, err));
      } else {
        if (doc) {
          // tolgo secondi
          var now = inputData.toTime
            ? inputData.toTime
            : doc.time
            ? doc.time
            : doc._id.time;
          now.setMilliseconds(0);
          if (inputData.interval > 1)
            now = myutils.floorTime(inputData.interval, now, true);
          var div = 1000 * inputData.depth;
          var newDate = new Date(now.getTime() - div);
          if (inputData.fromTime) {
            newDate = inputData.fromTime;
          } else {
            newDate = new Date(now.getTime() - inputData.current);
          }
          console.log("Extract from " + newDate + " to " + now);
          inputData.fromTime = newDate;
          inputData.toTime = now;
          inputData.callBackFunction(res, inputData);
        } else {
          res.json(
            httpUtils.createResponse(null, 100, "Nessun record trovato")
          );
        }
      }
    }
  );
}

module.exports.DeleteAll = deleteAll;
module.exports.CleanHTTPLog = cleanHTTPLog;
module.exports.CleanHTTPLogInternal = cleanHTTPLogInternal;

module.exports.GetDistinctApplication = distinctApplication;

//module.exports.GetStatistics = getStatistics;
module.exports.GetHTTPStatistics = getHTTPStatistics;

module.exports.GetHTTPCurrentPerformaceStatistics = getHTTPCurrentPerformaceStatistics;

/**
 * END
 */
