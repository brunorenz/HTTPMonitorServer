var mongoClient = require('mongodb').MongoClient;
/*
 * GET users listing.
 */

exports.list = function(req, res)
{
  var httpDBMo;
	mongoClient.connect("mongodb://"+url,(err,database) =>
  	{
  	  console.log("MONGO DB err : "+err);
  	  console.log("MONGO DB     : "+database);
  	  if (err) return console.log("ERRORE in connessione MongoDB "+err);
  	  assert.equal(null, err);
  	  
  	  httpDBMo = database;
  	  filterData(id);
  	});
  res.send("respond with a resource");
};