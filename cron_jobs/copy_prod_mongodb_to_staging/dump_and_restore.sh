mongodump --uri="${FROM_MONGODB_URI}" --db=production --authenticationDatabase=admin
mongorestore --drop --uri="${TO_MONGODB_URI}" --nsFrom="production.*" --nsTo="staging.*" dump/
