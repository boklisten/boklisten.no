mongodump --uri="${FROM_MONGODB_URI}" --db=production
rm -rf dump/admin dump/prelude.json
mongorestore --drop --uri="${TO_MONGODB_URI}" --nsFrom="production.*" --nsTo="staging.*" dump/
