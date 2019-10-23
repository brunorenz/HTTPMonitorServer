// TAIL Log
var Tail = require("always-tail");
var fs = require("fs");

var TailLog = function(server, httpDBMo, filename) {
  /**
   * Estrazione token URL
   *
   * @param data
   * @param token
   * @param del
   * @returns
   */
  function estraiPrefissoURL(data) {
    const token = "/";
    var d = null;
    var i = data.indexOf(token);
    if (i >= 0) {
      var t = data.substring(i + token.length);
      var j = t.indexOf("/");
      if (j > 0) {
        return t.substring(0, j);
      } else {
        j = t.indexOf(" ");
        if (j > 0) {
          return t.substring(0, j);
        }
      }
      return t;
    }
    return d;
  }

  /**
   * Estrazione dati da string in base ad un token
   *
   * @param data
   * @param token
   * @param del
   * @returns
   */
  function estraiToken(data, token, del) {
    var d = null;
    var i = data.indexOf(token);
    if (i >= 0) {
      var t = data.substring(i + token.length);
      var j = t.indexOf(del);
      if (j > 0) {
        return t.substring(0, j);
      } else {
        return t;
      }
    }

    return d;
  }

  /**
   * Enalizza riga di log ed estrazione dati in base a token definiti
   *
   * @param data
   * @returns
   */
  analizzaRiga = function(data) {
    var ti = estraiToken(data, "TI:", " ");
    if (ti != null) {
      var entry = {};
      entry.server = server;
      entry.ip = estraiToken(data, "IP:", " ");
      var ms = estraiToken(data, "MS:", " ");
      if (isNaN(ms)) {
        y = ti.substring(0, 4);
        m = ti.substring(5, 7);
        d = ti.substring(8, 10);
        h = ti.substring(11, 13);
        mi = ti.substring(14, 16);
        s = ti.substring(17, 19);
        entry.time = new Date(y, m - 1, d, h, mi, s, 0);
        //entry.tms_exe = entry.time;
      } else {
        entry.time = new Date(Number(ms));
        //entry.tms_exe = time;
      }

      entry.rc = Number(estraiToken(data, "RC:", " "));
      entry.elapse = Number(estraiToken(data, "EL:", " ")) / 1000;
      entry.method = estraiToken(data, "MD:", " ");
      entry.port = Number(estraiToken(data, "PR:", " "));
      var s = estraiToken(data, "SZ:", " ");
      entry.size = isNaN(s) ? 0 : Number(s);
      entry.referer = estraiToken(data, 'RE:"', '"');
      entry.userAgent = estraiToken(data, 'UA:"', '"');
      entry.request = estraiToken(data, 'RQ:"', '"');
      //entry.application = estraiPrefissoURL(entry.request);
      entry.application = estraiToken(entry.request, "/", "/");
      if (entry.application === "")
        entry.application = estraiToken(entry.request, "//", "/");
      httpDBMo.collection("httpLog").insertOne(entry, function(error, result) {
        if (error) console.error(error);
      });
    }
  };

  /**
   * Tail di un log, estrazione dati e insermento i DataBase
   *
   * @param filename
   * @returns
   */
  tailLog = function(filename) {
    console.log("Process Tail for file " + filename);
    if (fs.existsSync(filename)) {
      var wasLog = new Tail(filename, "\n");
      wasLog.on("line", this.analizzaRiga);
      wasLog.on("error", function(error) {
        console.log("ERROR: ", error);
      });
    } else {
      console.error("File " + filename + " does not exist..");
    }
  };
  tailLog(filename);
};

module.exports = TailLog;
