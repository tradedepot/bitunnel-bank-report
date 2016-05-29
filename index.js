'use strict';

let json2csv = require('json2csv'),
  fs = require('fs'),
  request = require('request'),
  _ = require('underscore'),
  moment = require('moment'),
  sourceName,
  mustNot, must,
  startDate, endDate;

const getProcessArg = (i) => {
  return new Promise((r) => { r(process.argv[i]) });
}

const getQuery = () => {
  switch (sourceName) {
    case 'fbn':
      must = "api.tradedepot.io";
      mustNot = "172.20.0.248";
      break;
    case 'nibss':
    default:
      must = "172.20.0.248";
      mustNot = "api.tradedepot.io";
  }

  return {
    "from": 0,
    "size": 1000,
    "sort": [{
      "@timestamp": { "order": "desc" }
    }],
    "query": {
      "bool": {
        "must": [
          { "match": { "log": "incoming-" } },
          { "match": { "log": "deposit" } },
          { "match": { "log": "CamelHttpMethod=POST" } },
          { "match": { "log": must } },
          { "match": { "kubernetes.container_name": "bitunnel*banking" } }, {
            "range": {
              "@timestamp": {
                "gte": startDate,
                "lte": endDate
              }
            }
          }
        ],
        "must_not": [
          { "match": { "log": mustNot } }
        ],
        "should": [
          { "match": { "log": "warehouse" } }
        ]
      }
    }
  }
}

// construct query data;
const getOpt = () => {
  return {
    url: process.env.ES_URL || 'localhost:9201',
    method: 'POST',
    auth: {
      'user': process.env.ES_USER || 'user',
      'pass': process.env.ES_PASS || 'secret',
      'sendImmediately': false
    },
    body: getQuery(),
    json: true,
    strictSSL: false
  }
}

/*
 * Lib
 */
//make http request
const makeRequest = (opt) => {
  return new Promise((res, rej) => {
    request(opt, (error, response, body) => {
      if (!error) {
        res(body);
      } else {
        rej(error);
      }
    })
  })
}

// Parse result to requested format
const parseResult = (data) => {
  return new Promise((res, rej) => {
    let result = []
    if (data) {
      data = data.hits.hits;
      _.each(data, (d) => {
        let tempObj, trxObj, source = d._source,
          timestamp = source['@timestamp'],
          log = source.log,
          logArr = log.split('bitunnel-break');

        if (_.size(logArr) > 1) {
          tempObj = JSON.parse(logArr[1].trim());
          tempObj.warehouseCode = tempObj.warehouseCode || '';
          tempObj.orderNumber = tempObj.orderNumber || '';
          delete tempObj.transactionID;
          trxObj = { timestamp: timestamp };
          result.push(_.extend(trxObj, tempObj));
        }
      });
      res(result);
    } else {
      rej(data);
    }
  })
}

//Writes a json array to csv
const writeToCSV = (jsonArr, fileName) => {
  return new Promise((res, rej) => {
    let keys = _.keys(jsonArr[0]),
      size = _.size(jsonArr);
    json2csv({ data: jsonArr, fields: keys }, (err, csv) => {
      if (err) console.log(err);
      fs.writeFile(fileName + '.csv', csv, (err) => {
        if (err) rej(err);
        res(`${size} records saved as  ${fileName}.csv`);
      });
    });
  })
}


//Synchronously perform all operations
getProcessArg(2)
  .then((a) => {
    sourceName = a || "nibss";
    return getProcessArg(3)
  })
  .then((b) => {
    startDate = moment(b).local().startOf('day').toISOString() || "1970-01-01T00:00:00+00:00";
    return getProcessArg(4)
  })
  .then((c) => {
    c = c || startDate;
    endDate = moment(c).local().endOf('day').toISOString() || "2099-12-31T23:59:00+00:00";
    return `Generating report for ${sourceName} from ${startDate} to ${endDate}`;
  })
  .then((d) => {
    console.log(`\n----------------------\n ${d} \n------------------------\n`);
    return makeRequest(getOpt())
  })
  .then((d) => {
    return parseResult(d);
  })
  .then((f) => {
    return writeToCSV(f, `${sourceName}-middleware-report`);
  })
  .then((g) => {
    console.log(`${g} \n=============================\n`);
  })
  .catch((e) => {
    console.log(e);
  });
