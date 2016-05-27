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
	node index.js `bank-name` `start-date` `end-date`
```
Eg To generate transactions for 23 and 24 feb, 2016
```
	node index.js nibss 2016-02-23 2016-02-24 
```

