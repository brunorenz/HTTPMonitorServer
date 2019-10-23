var http = require("http");
var webSocket = require("ws");
var globaljs = require("./global");

var params = function(req) {
  var result = {};
  var q = req.url.split("?");
  if (q.length >= 2) {
    var items = q[1].split("&");

    //.forEach(function(item)
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        result[item.split("=")[0]] = item.split("=")[1];
      } catch (e) {
        result[item.split("=")[0]] = "";
      }
    } //);
  }
  return result;
};

var httpPostJSON = function(options, postData, mycallback, param) {
  var headers = {
    "Content-Type": "application/json"
  };

  options.headers = headers;
  options.method = "POST";

  var req = http.request(options, function(res) {
    console.log("STATUS: " + res.statusCode);
    console.log("HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding("utf8");
    var body = "";
    res.on("data", function(d) {
      body += d;
    });
    res.on("end", function() {
      var parsed = JSON.parse(body);

      if (mycallback && typeof mycallback === "function") {
        if (param) {
          mycallback(parsed, param);
        } else {
          mycallback(parsed);
        }
      } else {
        console.log("RESPONSE: " + body);
      }
    });
  });

  req.on("error", function(err) {
    console.log(err);
  });
  req.write(JSON.stringify(postData));
  req.end();
};

var httpGetJSON = function(options, mycallback, param) {
  var headers = {
    "Content-Type": "application/json"
  };

  options.headers = headers;
  options.method = "GET";

  var req = http.get(options, function(res) {
    console.log("STATUS: " + res.statusCode);
    console.log("HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding("utf8");
    var body = "";
    res.on("data", function(d) {
      body += d;
    });
    res.on("end", function() {
      var parsed = JSON.parse(body);

      if (mycallback && typeof mycallback === "function") {
        if (param) {
          mycallback(parsed, param);
        } else {
          mycallback(parsed);
        }
      } else {
        console.log("RESPONSE: " + body);
      }
    });
  });

  req.on("error", function(err) {
    console.log(err);
  });
};
var mapGet = function(map, key) {
  var ret;
  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var entry = map[i];
      if (entry.key === key) {
        ret = entry.value;
        break;
      }
    }
    /*
     * map.forEach(function f(entry) { if (entry.key === key) { ret =
     * entry.value; } });
     */
  }
  return ret;
};

var mapPut = function(map, key, value) {
  if (map) {
    var found = false;
    for (
      var i = 0, len = map.length;
      i < len;
      i++ //for (var entry in map)
    ) {
      var entry = map[i];
      if (entry.key === key) {
        found = true;
        entry.value = value;
        break;
      }
    }
    /*
     * map.forEach(function f(entry) { if (entry.key === key) { found = true;
     * entry.value = value; } });
     */
    if (!found) {
      var entry = {
        key: key,
        value: value
      };
      map.push(entry);
    }
  }
};

var webSocketSendEvent = function(event) {
  var map = globaljs.WSS;
  if (map) {
    map.forEach(function f(entry) {
      var ws = entry.value.ws;
      console.log("CLIENT " + entry.key + " STATE : " + ws.readyState);
      if (ws.readyState === webSocket.OPEN) {
        console.log("Send EVENT " + event);
        ws.send(event);
      } else {
        console.log("Pospone EVENT " + event);
        entry.value.command = event;
        mapPut(map, entry.key, entry.value);
      }
    });
  }
};

var webSocketConnection = function(ws, req) {
  var s = globaljs.WSS;
  if (!s) {
    s = [];
    globaljs.WSS = s;
  }

  var ip = req.connection.remoteAddress;
  var entry = mapGet(s, ip);
  if (!entry) {
    console.log("WEBSOCKET (ADD) connection from client ip " + ip);
    entry = {
      ws: ws,
      command: null
    };
    mapPut(s, ip, entry);
  } else {
    console.log("WEBSOCKET (UPDATE) connection from client ip " + ip);
    entry.ws = ws;
    if (entry.command && entry.command !== null) {
      ws.send(entry.command);
      entry.command = null;
    }
    mapPut(s, ip, entry);
  }

  console.log("WEBSOCKET connection from client ip " + ip);

  /*
   * ws.on('ping', function incoming(message) { console.log('PING'); }); /*
   * ws.on('pong', function incoming(message) { console.log('PONG'); });
   * ws.on('open', function incoming(message) { console.log('OPEN'); });
   */
};

var floorTime = function(interval, time, isSecond) {
  var div = 1000 * interval;
  if (typeof isSecond == "undefined" || !isSecond) div = div * 60;
  var now = time === null ? new Date() : time;
  var l1 = now;
  var l2 = Math.floor(l1 / div) * div;
  return new Date(l2);
};

var createGraphStructure = function(data, emptyRecod) {
  var config = data.configurazione;
  var out = [];
  // Create scructure
  for (var i = 0; i < config.servers.length; i++) {
    var rec = {
      server: config.servers[i],
      dati: []
    };
    out.push(rec);
  }
  let interval = config.interval * 1000 * 60;
  // create empty record
  var n = (config.supDate.getTime() - config.infDate.getTime()) / interval;
  var dt = config.supDate.getTime();
  for (var i = 0; i < n; i++) {
    for (var j = 0; j < out.length; j++) {
      var rec = {
        time: new Date(dt),
        value: emptyRecod
      };
      out[j].dati.push(rec);
    }
    dt += interval;
  }
  console.log(JSON.stringify(out));
  return out;
};

module.exports.createGraphStructure = createGraphStructure;
module.exports.floorTime = floorTime;
module.exports.webSocketSendEvent = webSocketSendEvent;
module.exports.webSocketConnection = webSocketConnection;
module.exports.mapPut = mapPut;
module.exports.mapGet = mapGet;
module.exports.httpGetJSON = httpGetJSON;
module.exports.httpPostJSON = httpPostJSON;
module.exports.httpGetParam = params;
