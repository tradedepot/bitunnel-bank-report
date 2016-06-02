# elastic-search-query-csv-script

A simple nodejs based script that calls elastic search, parses the result and writes it to CSV.
It uses ES6 promise.

***To Use***

Clone 
```
 git clone 'repo'
```

**ENV Variables**
```
	process.env.ES_URL 
	process.env.ES_USER
	process.env.ES_PASS
```


**Script cli**

Usage
```
	node index.js `report-type` `bank-name` `start-date` `end-date`
```

Examples

To generate NIBSS transaction report (BANK-NAV) for 28 and 29 May, 2016
```
	node index.js bank nibss 2016-06-28 2016-06-29
```

To generate FIRST transaction reports (NAV-TDC) for 28 and 29 May, 2016
```
	node index.js nav nibss 2016-05-28 2016-05-29
```