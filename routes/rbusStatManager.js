var http = require("http");
var webSocket = require("ws");
var assert = require("assert");
var myutils = require("./myutils");
var httpUtils = require("./utils/httpUtils");
var aggregationUtils = require("./utils/aggregationUtils");
var globaljs = require("./global");

/**
 * Collect runtime statisctics about RBUS servicecs response time
 * @param {*} res
 * @param {*} inputData
 */
function collectRBUSPerformanceStatistics(res, inputData) {
  /**
   * Process result and apply sort in descending mode according the input parameter
   * @param {*} err
   * @param {*} values
   */
  var _createResultRBUS = function(err, values) {
    if (err) {
      console.log("ERROR in RBUSStatisticsResult mapReduce -  " + err);
      res.json(httpUtils.createResponse(null, 500, err));
    } else {
      let compareFunction = function(a, b) {
        if (a.value[inputData.sortField] === b.value[inputData.sortField])
          return 0;
        return a.value[inputData.sortField] < b.value[inputData.sortField]
          ? 1
          : -1;
      };
      let found = function(array, entry) {
        for (index = 0; index < array.length; index++)
          if (array[index] === entry) return true;
        return false;
      };
      var out = [];
      var distServer = [];
      if (values) {
        console.log("Restituiti " + values.length + " record!");
        var sortedValues = values.sort(compareFunction);
        for (var i = 0; i < sortedValues.length && i < inputData.depth; i++) {
          let value = sortedValues[i];
          var entry = {
            key: {},
            value: value.value
          };
          if (value._id.service) entry.key.service = value._id.service;
          if (value._id.server) {
            entry.key.server = value._id.server;
            if (!found(distServer, value._id.server))
              distServer.push(value._id.server);
          }
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
    }
  };

  var _finalize = function(key, value) {
    // verifico se ho un record non passato da MAP
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
    return value;
  };

  var _finalizeDay = function(key, value) {
    // verifico se ho un record non passato da MAP
    if (value.parent > 1) {
      value.elapseParent = value.elapseParent / value.parent;
    }
    if (value.ok > 1) {
      value.elapse = value.elapse / value.ok;
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
    var outOld = {
      ok: 0,
      ko: 0,
      tot: 1,
      elaOk: 0
    };
    var out = {
      parentOk: this.parent && this.ok ? 1 : 0,
      parentKo: this.parent && !this.ok ? 1 : 0,
      ok: this.ok ? 1 : 0,
      ko: this.ok ? 0 : 1,
      elapse: this.ok ? this.elapse : 0,
      elapseParent: this.parent && this.ok ? this.elapse : 0,
      elapseKo: !this.ok ? this.elapse : 0,
      elapseParentKo: this.parent && !this.ok ? this.elapse : 0
    };

    var key = {};
    if (server) key.server = this.serverName;
    if (interval > 0) {
      key.time = floorTimeSecond(interval, this.time);
    }
    if (service) key.service = this.serviceName;
    if (!this.serviceName.startsWith("JournalService")) emit(key, out);
  };

  var _mapDay = function() {
    var out = {
      parent: this.value.parent,
      ok: this.value.ok,
      ko: this.value.ko,
      elapse: this.value.elapse,
      elapseParent: this.value.elapseParent
    };
    out = this.value;
    // elimino media elapse prima di aggregazione

    var key = {};
    if (server) key.server = this._id.serverName;
    if (service) key.service = this._id.serviceName;
    let add = true;
    if (channel === "ALL") key.channel = this._id.channel;
    else if (channel != this._id.channel) add = false;
    if (this._id.serviceName.startsWith("JournalService")) add = false;
    if (add) emit(key, out);
  };

  var _reduceDay = function(key, values) {
    //print(">>> Key REDUCE ADD = " + tojson(key));
    var reduce = null;
    for (var index = 0; index < values.length; ++index) {
      var entry = values[index];
      if (reduce === null) {
        reduce = entry;
        //print(">>> Key REDUCE ADD = " + tojson(reduce));
      } else {
        reduce.ok += entry.ok;
        reduce.ko += entry.ko;
        reduce.parentOk += entry.parentOk;
        reduce.parentKo += entry.parentKo;
        reduce.elapseParent += entry.elapseParent;
        reduce.elapse += entry.elapse;
        reduce.elapseParentKo += entry.elapseParentKo;
        reduce.elapseKo += entry.elapseKo;
      }
    }
    return reduce;
  };

  var _createResult = function(err, values) {
    if (err) {
      console.log("ERROR in _getGenericData mapReduce -  " + err);
      res.json(createResponse(null, 500, err));
    } else {
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
    }
  };
  var query = {};
  if (inputData.collection === globaljs.collRBUS)
    query = {
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
  else
    query = {
      $and: [
        {
          "_id.time": {
            $gte: inputData.fromTime
          }
        },
        {
          "_id.time": {
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

  var _createResultFunction = _createResult;
  if (inputData.resultCallBackFunction === "RBUS") {
    _createResultFunction = _createResultRBUS;
  }
  globaljs.mongoCon.collection(inputData.collection).mapReduce(
    inputData.timeDepth === 0 ? _mapDay : _map,
    _reduceDay,
    {
      query: query,
      out: { inline: 1 },
      scope: {
        service: inputData.service,
        interval: inputData.interval,
        detail: inputData.detail,
        server: inputData.server,
        onlyKo: inputData.onlyKo,
        avg: inputData.avg,
        channel: inputData.channel
      },
      finalize: _finalize
    },
    _createResultFunction
  );
}

var getRBUSStatistics = function(req, res) {
  const DEF_INTERVAL = 0;
  const DEF_DEPTH = 15;
  if (!httpUtils.checkSecurity(req, res)) return;
  var now = new Date();
  // show all services or only paren
  var parent = req.query.parent ? req.query.parent === "true" : false;
  // show avarege elapse o total services
  var avg = req.query.avg ? req.query.avg === "true" : false;
  // show only services in error
  var onlyKo = req.query.onlyKo ? req.query.onlyKo === "true" : false;
  // number of services to show
  var depth = req.query.depth ? req.query.depth : DEF_DEPTH;
  // time in msec of services to show (0 = timeDepth day)
  var timeDepth = req.query.timeDepth ? req.query.timeDepth : 0;
  var inputData = {
    interval: 0,
    server: false,
    service: true,
    timeDepth: timeDepth,
    callBackFunction: collectRBUSPerformanceStatistics,
    resultCallBackFunction: "RBUS",
    onlyKo: onlyKo,
    collection: globaljs.collRBUS,
    depth: depth,
    avg: avg,
    channel: "ALL"
  };
  if (req.query.channel) {
    if (
      req.query.channel === "REST" ||
      req.query.channel === "EJB" ||
      req.query.channel === "SOAP"
    )
      inputData.channel = req.query.channel;
  }
  if (avg) {
    inputData.sort = parent
      ? onlyKo
        ? { "value.elapseParentKo": -1 }
        : { "value.elapseParent": -1 }
      : onlyKo
      ? { "value.elapseKo": -1 }
      : { "value.elapse": -1 };
    inputData.sortField = parent
      ? onlyKo
        ? "elapseParentKo"
        : "elapseParent"
      : onlyKo
      ? "elapseKo"
      : "elapse";
  } else {
    inputData.sort = parent
      ? onlyKo
        ? { "value.parentKo": -1 }
        : { "value.parentOk": -1 }
      : onlyKo
      ? { "value.ko": -1 }
      : { "value.ok": -1 };
    inputData.sortField = parent
      ? onlyKo
        ? "parentKo"
        : "parentOk"
      : onlyKo
      ? "ko"
      : "ok";
  }
  if (timeDepth === 0) {
    now.setMinutes(0);
    now.setSeconds(0);
    now.setMilliseconds(0);
    now.setHours(0);
    inputData.fromTime = new Date(now);
    inputData.collection = globaljs.collStatRbus;
  } else {
    inputData.collection = globaljs.collRBUS;
  }
  aggregationUtils.getLastCollectionRecord(res, inputData);
};

var getRBUSCurrentPerformaceStatistics = function(req, res) {
  const DEF_INTERVAL = 0;
  const DEF_DEPTH = 30; // 30 secondi
  const DEF_DETAIL = "true";
  if (!httpUtils.checkSecurity(req, res)) return;

  var interval = req.query.interval ? req.query.interval : DEF_INTERVAL;
  //var parent = req.query.parent ? req.query.parent === "true" : false;
  //var depth = req.query.depth ? req.query.depth : DEF_DEPTH;
  var timeDepth = req.query.timeDepth ? req.query.timeDepth : DEF_DEPTH;
  var server = req.query.server ? req.query.server == "true" : false;
  // show only services in error
  //var onlyKo = req.query.onlyKo ? req.query.onlyKo === "true" : false;

  var inputData = {
    interval: interval,
    server: server,
    service: false,
    channel: "ALL",
    callBackFunction: collectRBUSPerformanceStatistics,
    collection: globaljs.collRBUS,
    timeDepth: timeDepth
  };
  if (req.query.channel) {
    if (
      req.query.channel === "REST" ||
      req.query.channel === "EJB" ||
      req.query.channel === "SOAP"
    )
      inputData.channel = req.query.channel;
  }
  aggregationUtils.getLastCollectionRecord(res, inputData);
};

module.exports.GetRBUSCurrentPerformaceStatistics = getRBUSCurrentPerformaceStatistics;
module.exports.GetRBUSStatistics = getRBUSStatistics;

/**
 * END
 */
