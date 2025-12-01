// This  module defines a database connection to MongoDB


/* Connect to MongoDB:
To connect, you must add a MongoDB connection string as an environment variable 
The name/key of the environment variable must be "DATABASE_URL"
The value of the variable must be a valid MongoDB connection string. 
You can locate the string in your MongoDB Atlas dashboard.
See also: https://account.mongodb.com/account/login  
See also: https://mongoosejs.com/docs/connections.html */
import mongoose from 'mongoose';

let connection = null;

function connectToDatabase() {
  if (!connection) {
    connection = mongoose.connect(process.env.DATABASE_URL)
      .then(mongooseInstance => {
        console.log(`Mongoose ${mongooseInstance.version} connected to MongoDB.`);
        console.log(`Host: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      })
      .catch(error => {
        console.log('MongoDB connection failed.');
        console.log(error.message);
        // Allow future retries
        connection = null;
        throw error;
      });
  }
  return connection;
}

async function mongoReady(req, res, next) {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    return res
      .status(503)
      .json({ error: 'Database connection not ready' });
  }
}

export { mongoReady };