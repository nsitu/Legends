# Local Legends

## About
This demo illustrates how Google Maps can be used for two separate use cases:
- as a means to display stories attached to specific geographic locations. 
- as a location picker to select a place on the map as part of a data gathering process.

## Setup
You will need to add a MongoDB connection string to your environment so that stories can be saved there. For example, add something similar to the following to your `.env` file.
```
DATABASE_URL=mongodb+srv://user:pass@cluster0.abc123.mongodb.net/database
```

## Mongoose vs Prisma
This project uses [Mongoose](https://mongoosejs.com/) to communicate with the database. This differs somewhat from other examples in our course (elsewhere, we used [Prisma](https://www.npmjs.com/package/prisma) instead). The reason we're using Mongoose here is that it supports [geospatial indexes](https://mongoosejs.com/docs/8.x/docs/geojson.html#geospatial-indexes), which can improve performance for location-based queries.

## Google Maps API Key
Normally you would keep your API hidden in the backend. However, the Google Maps API Key is a frontend-only key. It assumes a different security model, where restrictions are placed via the Google Cloud Console. Indeed, the key included here has been restricted. You may only use it on `localhost:3000` and on `*.vercel.app/*`. Feel free to use it for your student project. If you'd like to get your own key, keep reading!

## Google Developer Group
If you're a Sheridan Student, check out the [Google Developer Group](https://gdg.community.dev/gdg-on-campus-sheridan-college-trafalgar-road-campus-oakville-canada/). This is a great avenue to gain access to further support, community, and Google Cloud credits. 
