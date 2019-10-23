var globaljs = require("./global");
var myutils = require("./myutils");
//var assert = require("assert");

function manageRestart(param, httpDBMo, error) {
  if (error) {
    console.error("Errore in StatHTTP : " + err);
  }
  console.log("Rischedulo tra " + param.timeout + " millisecondi");
  setTimeout(param.callback, param.timeout, httpDBMo);
}

var httpStatFinalize = function(key, reducedValue) {
  var finalValue = {
    okCount: 0,
    totalTime: 0,
    totalSize: 0,
    redirectCount: 0,
    totalTimeRedirect: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    notClassifiedCount: 0,
    time: key.time,
    timeL: key.time.getTime(),
    method: key.method,
    num: 0
  };
  if (!reducedValue.num) {
    // duplicato da funzione reduce
    // solo in caso di un solo record
    finalValue.num = 1;
    if (reducedValue.rc < 300) {
      finalValue.okCount++;
      finalValue.totalTime = reducedValue.elapse;
      finalValue.totalSize = reducedValue.size;
      finalValue.avarageTime = finalValue.totalTime;
      finalValue.avarageSize = finalValue.totalSize;
    } else if (reducedValue.rc < 400) {
      finalValue.redirectCount++;
      finalValue.totalTimeRedirect += reducedValue.elapse;
      finalValue.avarageTimeRedirect = finalValue.totalTimeRedirect;
    } else if (reducedValue.rc < 500) {
      finalValue.clientErrorCount++;
    } else if (reducedValue.rc < 600) {
      finalValue.serverErrorCount++;
    } else {
      finalValue.notClassifiedCount++;
    }
  } else {
    finalValue.okCount = reducedValue.okCount;
    finalValue.totalTime = reducedValue.totalTime;
    finalValue.totalSize = reducedValue.totalSize;
    finalValue.redirectCount = reducedValue.redirectCount;
    finalValue.totalTimeRedirect = reducedValue.totalTimeRedirect;
    finalValue.clientErrorCount = reducedValue.clientErrorCount;
    finalValue.serverErrorCount = reducedValue.serverErrorCount;
    finalValue.notClassifiedCount = reducedValue.notClassifiedCount;
    finalValue.num = reducedValue.num;

    if (reducedValue.okCount && reducedValue.okCount > 0) {
      finalValue.avarageTime = reducedValue.totalTime / reducedValue.okCount;
      finalValue.avarageSize = reducedValue.totalSize / reducedValue.okCount;
    }
    if (reducedValue.redirectCount && reducedValue.redirectCount > 0) {
      finalValue.avarageTimeRedirect =
        reducedValue.totalTimeRedirect / reducedValue.redirectCount;
    }
  }
  return finalValue;
};

// Variable for map
var httpStatMap = function() {
  /**
   * arrotonda Data
   * @param {*} interval
   * @param {*} time
   */
  var floorTime = function(interval, time) {
    var div = 1000 * 60 * interval;
    var now = time === null ? new Date() : time;
    var l1 = now;
    var l2 = Math.floor(l1 / div) * div;
    return new Date(l2);
  };
  /**
   * decodifica applicazione
   * @param {*} app
   */
  var getApplication = function(app) {
    const defApp = "NULL";
    try {
      if (app === null) return defApp;
      if (app === "libs" || app === "etc" || app === "content")
        return "BPBSite";
      if (
        app === "hbas" ||
        app === "onetoone" ||
        app === "ssbe" ||
        app === "console" ||
        app === "console HTTP" ||
        app === "downloadManager" ||
        app === "sws" ||
        app === "otoRepository"
      )
        return "AURIGA WWS";
      if (
        app === "branchintegration" ||
        app === "promote" ||
        app === "a2e-webpromote-ws" ||
        app === "orchestra-ws" ||
        app === "orchestra" ||
        app === "A2E-SupportServices-WS" ||
        app === "connections"
      )
        return "NCR";
      if (
        app === "AtmServices" ||
        app === "RBUSServices" ||
        app === "BPBCoreServices"
      )
        return "RBUSServer";
      if (app.startsWith("RBUSRest")) return "RBUSServerRest";
      if (app === "Backoffice" || app === "RBUSUtility")
        return "RBUSApplication";
      if (app.startsWith("PPEWeb") || app.startsWith("PFPWeb")) return "PFP";
      if (app.startsWith("vl.web")) return "VirtualLibrary";
      if (app.startsWith("DGSWebBUD") || app.startsWith("budget"))
        return "PFPBudget";
      return app;
    } catch (error) {}
    return defApp;
  };
  var data = floorTime(interval, this.time);
  var application = getApplication(this.application);
  var key = {
    method: this.method,
    time: data,
    server: this.server,
    application: application
  };
  var record = {
    rc: this.rc,
    elapse: this.elapse,
    size: this.size,
    elapse: this.elapse
  };
  emit(key, record);
};

// Variable for reduce
var httpStatReduce = function(key, values) {
  var reducedValue = {
    okCount: 0,
    totalTime: 0,
    totalSize: 0,
    redirectCount: 0,
    totalTimeRedirect: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    notClassifiedCount: 0,
    time: key.time,
    timeL: key.time.getTime(),
    num: 0
  };
  var first = true;
  for (var index = 0; index < values.length; ++index) {
    value = values[index];
    if (value.num && first) {
      reducedValue.redirectCount = value.redirectCount;
      reducedValue.totalTimeRedirect = value.totalTimeRedirect;
      reducedValue.okCount = value.okCount;
      reducedValue.totalTime = value.totalTime;
      reducedValue.totalSize = value.totalSize;
      reducedValue.clientErrorCount = value.clientErrorCount;
      reducedValue.serverErrorCount = value.serverErrorCount;
      reducedValue.notClassifiedCount = value.notClassifiedCount;
      reducedValue.num = value.num;
      first = false;
    } else {
      reducedValue.num++;
      if (value.rc < 300) {
        reducedValue.okCount++;
        reducedValue.totalTime += value.elapse;
        reducedValue.totalSize += value.size;
      } else if (value.rc < 400) {
        reducedValue.redirectCount++;
        reducedValue.totalTimeRedirect += value.elapse;
      } else if (value.rc < 500) {
        reducedValue.clientErrorCount++;
      } else if (value.rc < 600) {
        reducedValue.serverErrorCount++;
      } else {
        reducedValue.notClassifiedCount++;
      }
    }
  }
  var i =
    reducedValue.okCount +
    reducedValue.clientErrorCount +
    reducedValue.serverErrorCount +
    reducedValue.notClassifiedCount +
    reducedValue.redirectCount;
  if (i != reducedValue.num) {
    print(
      "REDUCE key = (" +
        key.time +
        " " +
        key.method +
        " " +
        key.application +
        ") LEN = " +
        values.length +
        " TOT " +
        reducedValue.num +
        " - " +
        i
    );
  }
  return reducedValue;
};

var httpStatFullFinalize = function(key, reducedValue) {
  var finalValue;
  if (reducedValue._id) finalValue = reducedValue.value;
  else {
    finalValue = reducedValue;
    if (reducedValue.okCount && reducedValue.okCount > 0) {
      finalValue.avarageTime = reducedValue.totalTime / reducedValue.okCount;
      finalValue.avarageSize = reducedValue.totalSize / reducedValue.okCount;
    }
    if (reducedValue.redirectCount && reducedValue.redirectCount > 0) {
      finalValue.avarageTimeRedirect =
        reducedValue.totalTimeRedirect / reducedValue.redirectCount;
    }
  }
  return finalValue;
};

var httpStatFullMap = function() {
  var key = {
    time: this._id.time,
    server: this._id.server,
    application: this._id.application
  };
  emit(key, this.value);
};

var httpStatFullReduce = function(key, values) {
  var reducedValue = {
    okCount: 0,
    totalTime: 0,
    totalSize: 0,
    redirectCount: 0,
    totalTimeRedirect: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    notClassifiedCount: 0,
    time: key.time,
    timeL: key.time.getTime(),
    num: 0
  };
  for (var index = 0; index < values.length; ++index) {
    var value = values[index];
    if (value.method) {
      // first
      reducedValue.redirectCount += value.redirectCount;
      reducedValue.totalTimeRedirect += value.totalTimeRedirect;
      reducedValue.okCount += value.okCount;
      reducedValue.totalTime += value.totalTime;
      reducedValue.totalSize += value.totalSize;
      reducedValue.clientErrorCount += value.clientErrorCount;
      reducedValue.serverErrorCount += value.serverErrorCount;
      reducedValue.notClassifiedCount += value.notClassifiedCount;
      reducedValue.num += value.num;
    } else {
      // cumulative
      reducedValue.redirectCount = value.redirectCount;
      reducedValue.totalTimeRedirect = value.totalTimeRedirect;
      reducedValue.okCount = value.okCount;
      reducedValue.totalTime = value.totalTime;
      reducedValue.totalSize = value.totalSize;
      reducedValue.clientErrorCount = value.clientErrorCount;
      reducedValue.serverErrorCount = value.serverErrorCount;
      reducedValue.notClassifiedCount = value.notClassifiedCount;
      reducedValue.num = value.num;
    }
  }
  return reducedValue;
};

var StatHTTP = function(param, httpDBMo) {
  // Variable for finalize

  /**
   * Comulate statistic
   */
  function getLastCumulative(t0, t1) {
    console.log(
      "Primo MAP-REDUCE HTTP terminato per intervallo " + t0 + " - " + t1
    );
    httpDBMo.collection("httpStat").mapReduce(
      httpStatFullMap,
      httpStatFullReduce,
      {
        query: {
          $and: [
            {
              "_id.time": {
                $gte: t0
              }
            },
            {
              "_id.time": {
                $lt: t1
              }
            }
          ]
        },
        out: {
          merge: "httpStatFull",
          nonAtomic: true
        },
        finalize: httpStatFullFinalize
      },
      function(err, collection, stats) {
        if (err) {
          console.error("ERROR in secondo MapReduce");
        } else {
          console.log(
            "Secondo MAP-REDUCE HTTP terminato per intervallo " +
              t0 +
              " - " +
              t1
          );
        }
        manageRestart(param, httpDBMo, err);
      }
    );
  }

  /**
   * GetLast
   */
  function getLastHTTP(entry) {
    httpDBMo.collection(globaljs.collLog).findOne(
      {},
      {
        sort: {
          $natural: -1
        }
      },
      function(err, doc) {
        if (err) {
          console.error("Errore lettura httpLog");
          manageRestart(param, httpDBMo, err);
        } else {
          if (doc) {
            // escludi ultimo intervallo
            var t1 = myutils.floorTime(param.interval, doc.time);
            var t0 = entry.lst_exe;
            console.log("HTTP Last record found with TMS : " + doc.time);
            console.log("HTTP Last record round          : " + t1);
            console.log("HTTP Last TMS grouped           : " + t0);

            if (t1.getTime() > t0.getTime()) {
              console.log("Select records  from " + t0 + " to " + t1);
              //entry.lst_exe = t1;
              httpDBMo.collection(globaljs.collConfig).updateOne(
                {
                  _id: entry._id
                },
                {
                  $set: {
                    lst_exe: t1
                  }
                }
              );
              httpDBMo.collection(globaljs.collLog).mapReduce(
                httpStatMap,
                httpStatReduce,
                {
                  query: {
                    $and: [
                      {
                        time: {
                          $gte: t0
                        }
                      },
                      {
                        time: {
                          $lt: t1
                        }
                      }
                    ]
                  },
                  out: {
                    merge: "httpStat",
                    nonAtomic: true
                  },
                  scope: {
                    tF: t0,
                    tL: t1,
                    interval: param.interval
                  },
                  finalize: httpStatFinalize
                },
                function(err, collection, stats) {
                  if (err) {
                    console.error("ERROR in primo MapReduce");
                    manageRestart(param, httpDBMo, err);
                  } else {
                    getLastCumulative(t0, t1);
                  }
                }
              );
            } else {
              console.log("Nessuna riga di log trovata da " + t0);
              manageRestart(param, httpDBMo, err);
            }
          } else {
            console.log("Nessun record presente in httpLog");
            manageRestart(param, httpDBMo, err);
          }
        }
      }
    );
  }

  // MAIN
  if (!param.interval) param.interval = 1;
  if (!param.timeout) param.timeout = 1000 * 60;
  param.key = globaljs.keyHTTP;
  param.processCallback = getLastHTTP;
  console.log("StatHTTP input parameter " + JSON.stringify(param));
  processFromLastLogCollectedRecord(param, httpDBMo);
};

var rbusReduce = function(key, values) {
  var reduce = null;
  for (var index = 0; index < values.length; ++index) {
    var entry = values[index];

    if (reduce === null) {
      reduce = entry;
    } else {
      reduce.parentKo += entry.parentKo;
      reduce.parentOk += entry.parentOk;
      reduce.ok += entry.ok;
      reduce.ko += entry.ko;
      reduce.elapse += entry.elapse;
      reduce.elapseParent += entry.elapseParent;
      reduce.elapseKo += entry.elapseKo;
      reduce.elapseParentKo += entry.elapseParentKo;
    }
  }
  return reduce;
};
var rbusMap = function() {
  /**
   * arrotonda Data
   * @param {*} interval
   * @param {*} time
   */
  var floorTime = function(interval, time) {
    var div = 1000 * 60 * interval;
    var now = time === null ? new Date() : time;
    var l1 = now;
    var l2 = Math.floor(l1 / div) * div;
    return new Date(l2);
  };
  var data = floorTime(interval, this.time);
  key = {
    time: data,
    serverName: this.serverName,
    serviceName: this.serviceName,
    channel: this.channel
  };
  record = {
    parentOk: this.parent && this.ok ? 1 : 0,
    parentKo: this.parent && !this.ok ? 1 : 0,
    ok: this.ok ? 1 : 0,
    ko: this.ok ? 0 : 1,
    elapse: this.ok ? this.elapse : 0,
    elapseParent: this.parent && this.ok ? this.elapse : 0,
    elapseKo: !this.ok ? this.elapse : 0,
    elapseParentKo: this.parent && !this.ok ? this.elapse : 0
  };
  emit(key, record);
};
var rbusFinalize = function(key, value) {
  if (value.serverName) {
    let out = {
      parentOk: value.parent && value.ok ? 1 : 0,
      parentKo: value.parent && !value.ok ? 1 : 0,
      ok: value.ok ? 1 : 0,
      ko: value.ok ? 0 : 1,
      elapse: value.ok ? value.elapse : 0,
      elapseParent: value.parent && value.ok ? value.elapse : 0,
      elapseKo: !value.ok ? value.elapse : 0,
      elapseParentKo: value.parent && !value.ok ? value.elapse : 0
    };
    value = out;
  } else {
    // non aggrego
    if (false) {
      if (value.ok > 1) {
        value.elapse = value.elapse / value.ok;
      }
      if (value.ko > 1) {
        value.elapseKo = value.elapseKo / value.ko;
      }
      if (value.parentOk > 1) {
        value.elapseParent = value.elapseParent / value.parentOk;
      }
      if (value.parentKo > 1) {
        value.elapseParentKo = value.elapseParentKo / value.parentKo;
      }
    }
  }
  return value;
};

var StatRBUS = function(param, httpDBMo) {
  /**
   * GetLast
   */
  function getLastRBUS(entry) {
    httpDBMo.collection(globaljs.collRBUS).findOne(
      {},
      {
        sort: {
          $natural: -1
        }
      },
      function(err, doc) {
        if (err) {
          console.error("Errore lettura rbusPerformance");
          manageRestart(param, httpDBMo, err);
        } else {
          if (doc) {
            // escludi ultimo intervallo
            var t1 = myutils.floorTime(param.interval, doc.time);
            var t0 = entry.lst_exe;
            console.log("RBUS Last record found with TMS : " + doc.time);
            console.log("RBUS Last record round          : " + t1);
            console.log("RBUS Last TMS grouped           : " + t0);

            if (t1.getTime() > t0.getTime()) {
              console.log("Select records  from " + t0 + " to " + t1);
              //entry.lst_exe = t1;
              httpDBMo.collection(globaljs.collConfig).updateOne(
                {
                  _id: entry._id
                },
                {
                  $set: {
                    lst_exe: t1
                  }
                }
              );
              httpDBMo.collection(globaljs.collRBUS).mapReduce(
                rbusMap,
                rbusReduce,
                {
                  query: {
                    $and: [
                      {
                        time: {
                          $gte: t0
                        }
                      },
                      {
                        time: {
                          $lt: t1
                        }
                      }
                    ]
                  },
                  out: {
                    merge: "httpStatRbus",
                    nonAtomic: true
                  },
                  scope: {
                    tF: t0,
                    tL: t1,
                    interval: param.interval
                  },
                  finalize: rbusFinalize
                },
                function(err, collection, stats) {
                  if (err) {
                    console.error("ERROR in secondo MapReduce");
                  } else {
                    console.log(
                      "Primo MAP-REDUCE RBUS terminato per intervallo " +
                        t0 +
                        " - " +
                        t1
                    );
                  }
                  manageRestart(param, httpDBMo, err);
                }
              );
            } else {
              console.log("Nessuna riga di log trovata da " + t0);
              manageRestart(param, httpDBMo, err);
            }
          } else {
            console.log("Nessun record presente in httpLog");
            manageRestart(param, httpDBMo, err);
          }
        }
      }
    );
  }

  // MAIN
  if (!param.interval) param.interval = 1;
  if (!param.timeout) param.timeout = 1000 * 60;
  param.key = globaljs.keyRBUS;
  param.processCallback = getLastRBUS;
  console.log("StatRBUS input parameter " + JSON.stringify(param));
  processFromLastLogCollectedRecord(param, httpDBMo);
};

/**
 * FilterData
 */
function processFromLastLogCollectedRecord(param, httpDBMo) {
  var data = new Date();
  data.setSeconds(0);
  data.setMilliseconds(0);
  data.setMinutes(0);
  data.setHours(0);
  var entry = {
    _id: param.key,
    lst_exe: data
  };
  httpDBMo.collection(globaljs.collConfig).findOne(
    {
      _id: param.key
    },
    function(err, doc) {
      console.log("Check last update date for KEY " + param.key);
      if (err) {
        console.error("ERRORE lettura data " + err);
        manageRestart(param, httpDBMo, err);
      } else {
        console.log("Letto " + doc);
        if (!doc) {
          console.log("INSERT RECORD whith id = " + param.key);
          httpDBMo
            .collection(globaljs.collConfig)
            .insertOne(entry, function(err, doc) {
              if (err) console.log("ERRORE inserimento dati " + err);
            });
        } else entry = doc;
        if (param.processCallback) param.processCallback(entry);
      }
    }
  );
}

var CollectRBUS = function(req, res) {
  var param = {
    interval: globaljs.options.intervalRBUS,
    timeout: globaljs.options.timeoutRBUS
    //callback: refreshHTTPData
  };
  //StatRBUS(param, globaljs.mongoCon);

  res.json("{}");
};

module.exports.StatHTTP = StatHTTP;
module.exports.StatRBUS = StatRBUS;
module.exports.CollectRBUS = CollectRBUS;
