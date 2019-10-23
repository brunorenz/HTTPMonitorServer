var globaljs = require('./global');
var assert = require('assert');

var StatHTTP = function(id, httpDBMo)
{

	// Variable for finalize
	var httpStat_finalize = function(key, reducedValue)
	{
		var finalValue =
		{
			okCount : 0,
			totalTime : 0,
			totalSize : 0,
			redirectCount : 0,
			totalTimeRedirect : 0,
			clientErrorCount : 0,
			serverErrorCount : 0,
			notClassifiedCount : 0,
			time : key.time,
			timeL : key.time.getTime(),
			method : key.method,
			num : 0
		}
		if (!reducedValue.num)
		{
			// duplicato da funzione reduce
			// solo in caso di un solo record
			finalValue.num = 1;
			if (reducedValue.rc < 300)
			{
				finalValue.okCount++;
				finalValue.totalTime = reducedValue.elapse;
				finalValue.totalSize = reducedValue.size;
				finalValue.avarageTime = finalValue.totalTime;
				finalValue.avarageSize = finalValue.totalSize;
			} else if (reducedValue.rc < 400)
			{
				finalValue.redirectCount++;
				finalValue.totalTimeRedirect += reducedValue.elapse;
				finalValue.avarageTimeRedirect = finalValue.totalTimeRedirect
			} else if (reducedValue.rc < 500)
			{
				finalValue.clientErrorCount++;
			} else if (reducedValue.rc < 600)
			{
				finalValue.serverErrorCount++;
			} else
			{
				finalValue.notClassifiedCount++;
			}
		} else
		{
			finalValue.okCount = reducedValue.okCount;
			finalValue.totalTime = reducedValue.totalTime;
			finalValue.totalSize = reducedValue.totalSize;
			finalValue.redirectCount = reducedValue.redirectCount;
			finalValue.totalTimeRedirect = reducedValue.totalTimeRedirect;
			finalValue.clientErrorCount = reducedValue.clientErrorCount;
			finalValue.serverErrorCount = reducedValue.serverErrorCount;
			finalValue.notClassifiedCount = reducedValue.notClassifiedCount;
			finalValue.num = reducedValue.num;

			if (reducedValue.okCount && reducedValue.okCount > 0)
			{
				finalValue.avarageTime = reducedValue.totalTime / reducedValue.okCount;
				finalValue.avarageSize = reducedValue.totalSize / reducedValue.okCount;
			}
			if (reducedValue.redirectCount && reducedValue.redirectCount > 0)
			{
				finalValue.avarageTimeRedirect = reducedValue.totalTimeRedirect
						/ reducedValue.redirectCount;
			}
		}
		return finalValue;
	};

	// Variable for map
	var httpStat_map = function()
	{
		var getApplication = function(app)
		{
			if (app === 'hbas' || app == 'onetoone' || app === 'ssbe'
					|| app === 'console' || app === 'downloadManager')
				return "AURIGA";
			if (app === 'a2e-webpromote-ws' || app == 'orchestra-ws')
				return "NCR"
			if (app === 'RBUSRestAtmServices')
				return "RBUS"
			return app;
		}
		var compareDate = function(d0, d1)
		{
			d0.setMilliseconds(0);
			d1.setMilliseconds(0);
			var n0 = d0.getTime();
			var n1 = d1.getTime();
			return n0 > n1 ? 1 : ((n0 < n1) ? -1 : 0);
		};
		process = true;
		if (tF && compareDate(this.tms_exe, tF) < 0)
			process = false;
		if (tL && compareDate(this.tms_exe, tL) >= 0)
			process = false;
		if (process == true)
		{
			var data = new Date(this.tms_exe);
			data.setSeconds(0);
			data.setMilliseconds(0);
			var application = getApplication(this.application);
			var key =
			{
				method : this.method,
				time : data,
				server : this.server,
				application : application
			};
			var record =
			{
				rc : this.rc,
				elapse : this.elapse,
				size : this.size,
				elapse : this.elapse

			}
			emit(key, record);
		}
	};

	// Variable for reduce
	var httpStat_reduce = function(key, values)
	{
		var reducedValue =
		{
			okCount : 0,
			// avarageTime : 0,
			// avarageSize : 0,
			totalTime : 0,
			totalSize : 0,
			redirectCount : 0,
			// avarageTimeRedirect : 0,
			totalTimeRedirect : 0,
			// avarageSizeRedirect : 0,
			clientErrorCount : 0,
			serverErrorCount : 0,
			notClassifiedCount : 0,
			time : key.time,
			timeL : key.time.getTime(),
			// methodX : key.method,
			num : 0
		}
		// reducedValue.num = values.length;
		var first = true;
		values.forEach(function(value)
		{
			if (value.num && first)
			{
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
			} else
			{
				reducedValue.num++;
				if (value.rc < 300)
				{
					reducedValue.okCount++;
					reducedValue.totalTime += value.elapse;
					reducedValue.totalSize += value.size;
				} else if (value.rc < 400)
				{
					reducedValue.redirectCount++;
					reducedValue.totalTimeRedirect += value.elapse;
				} else if (value.rc < 500)
				{
					reducedValue.clientErrorCount++;
				} else if (value.rc < 600)
				{
					reducedValue.serverErrorCount++;
				} else
				{
					reducedValue.notClassifiedCount++;
				}
			}
		});
		var i = reducedValue.okCount + reducedValue.clientErrorCount
				+ reducedValue.serverErrorCount + reducedValue.notClassifiedCount
				+ reducedValue.redirectCount;
		if (i != reducedValue.num)

		{
			print("REDUCE key = (" + key.time + " " + key.method + " "
					+ key.application + ") LEN = " + values.length + " TOT "
					+ reducedValue.num + " - " + i);
		}
		return reducedValue;
	};

	function getLast(entry)
	{
		httpDBMo.collection('httpLog').findOne(
				{},
				{
					sort :
					{
						$natural : -1
					}
				},
				function(err, doc)
				{
					if (err != null)
						console.log("ERRORE lettura data " + err);
					else
					{
						if (doc)
							console.log("Last ID " + doc._id + " TMS " + doc.tms_exe);
						// escludi ultimo minuto
						t1 = doc.tms_exe;
						t1.setSeconds(0);
						t1.setMilliseconds(0);
						t0 = entry.lst_exe;
						if (doc && doc.tms_exe)
							t1 = doc.tms_exe;
						console.log("QUERY First : " + t0 + " - Last : " + t1);
						entry.lst_exe = t1;
						httpDBMo.collection('httpLogConfig').updateOne(
						{
							_id : entry._id
						},
						{
							$set :
							{
								lst_exe : t1
							}
						});
						httpDBMo.collection('httpLog').mapReduce(
								httpStat_map,
								httpStat_reduce,
								{
									query :
									{
										tms_exe :
										{
											$gt : t0
										}
									},
									out :
									{
										replace : "httpStatTemp",
									// nonAtomic : true
									},
									scope :
									{
										tF : t0,
										tL : t1
									},
									finalize : httpStat_finalize
								},
								function(err, collection, stats)
								{
									if (err)
										console.log("ERROR in scrittura httpStat " + err);
									else
									{
										console.log("MAP-REDUCE terminato per intervallo " + t0
												+ " - " + t1);
									}
								}

						);
					}
				});
	}

	function filterData(id)
	{
		// var entry =
		// {};
		// entry._id = id;
		// parta da oggi
		var data = new Date();
		data.setSeconds(0);
		data.setMilliseconds(0);
		data.setMinutes(0);
		data.setHours(0)
		var entry =
		{
			_id : id,
			lst_exe : data
		};
		httpDBMo.collection('httpLogConfig').findOne(
				{
					_id : id
				},
				function(err, doc)
				{
					console.log("check last update date");
					if (err)
					{
						console.log("ERRORE lettura data " + err);
					} else
					{
						console.log("Letto " + doc)
						if (!doc)
						{
							console.log("INSERT RECORD whith id = " + id)
							httpDBMo.collection('httpLogConfig').insertOne(entry,
									function(err, doc)
									{
										if (err)
											console.log("ERRORE inserimento dati " + err);
									});
						} else
							entry = doc;

						getLast(entry);

					}
				});

	}

	// MAIN
	filterData(id);
}

module.exports.StatHTTP = StatHTTP;
