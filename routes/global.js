var urlDB = "srvvs35.bpbari.it:27017";
var urlDBLocal = "localhost:27017";
var DBName = "HTTPLog";
var fced1 = "/mnt/CEDSHARE/AEM/logs/aem1/HTTPAccessMonitor.log";
var fced2 = "/mnt/CEDSHARE/AEM/logs/aem2/HTTPAccessMonitor.log";
var fcedr1 = "/mnt/CEDSHARE/RBUS/logs/HTTP01AccessMonitor.log";
var fcedr2 = "/mnt/CEDSHARE/RBUS/logs/HTTP02AccessMonitor.log";
var fwas1 = "/share/RBUSWAS/logs/HTTPAccessMonitor.log";
var fwas1B = "/share/RBUS/logs/HTTPAccessMonitor.log";
var keyHTTP = "http";
var keyRBUS = "rbus";
var onlyServer = true;
var onlyTail = false;
var serverPort = 8099;

var collLog = "httpLog";
var collRBUS = "rbusPerformance";
var collConfig = "httpLogConfig";
var collStat = "httpStat";
var collStatRbus = "httpStatRbus";
var collStatFull = "httpStatFull";
var mongoCon;

var options = {
  urlDB: urlDB,
  onlyServer: onlyServer,
  onlyTail: onlyTail,
  filesToTail: [],
  timeoutHTTP: 15000,
  intervalHTTP: 0.25,
  timeoutRBUS: 30000,
  intervalRBUS: 0.5
};

exports.collRBUS = collRBUS;
exports.DBName = DBName;
exports.urlDB = urlDB;
exports.fced1 = fced1;
exports.fced2 = fced2;
exports.fcedr1 = fcedr1;
exports.fcedr2 = fcedr2;
exports.fwas1 = fwas1;
exports.keyHTTP = keyHTTP;
exports.keyRBUS = keyRBUS;
exports.mongoCon = mongoCon;
exports.options = options;
exports.SERVER_PORT = serverPort;
exports.onlyServer = onlyServer;
exports.onlyTail = onlyTail;
exports.collLog = collLog;
exports.collConfig = collConfig;
exports.collStat = collStat;
exports.collStatRbus = collStatRbus;
exports.collStatFull = collStatFull;
