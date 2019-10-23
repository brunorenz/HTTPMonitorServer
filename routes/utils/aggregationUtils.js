var globaljs = require("../global");
var myutils = require("../myutils");
/**
 * Get last tms_exe in the httpLog
 * @param {*} res
 * @param {*} inputData
 */
module.exports.getLastCollectionRecord = function(res, inputData) {
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
        res.json(createResponse(null, 500, err));
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
            newDate = new Date(now.getTime() - inputData.timeDepth * 1000);
          }
          console.log("Extract from " + newDate + " to " + now);
          inputData.fromTime = newDate;
          inputData.toTime = now;
          inputData.callBackFunction(res, inputData);
        } else {
          res.json(createResponse(null, 100, "Nessun record trovato"));
        }
      }
    }
  );
};
