// import Express library and activate it
import express from "express";
const app = express();

// import path module to help with file paths
import path from 'path';

// Serve static files from the 'public' folder
app.use(express.static('public'))

// On Vercel, point the root url (/) to index.html explicitly
if (process.env.VERCEL) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
    })
}


import cors from 'cors'
app.use(cors())
app.use(express.json())

import { Story } from "./models/StoryModel.js"
import { mongoReady } from './database.js'


/** Endpoint for fetching nearby stories from MongoDB */
// the user's location is passed along via query parameters
app.get('/api/stories', mongoReady, async (req, res) => {
    // Query mongoDB for nearby stories using the $near operator
    // see also: https://www.mongodb.com/docs/manual/reference/operator/query/near/
    let stories = await Story.find({
        "location": {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: [req.query.lng, req.query.lat]
                },
                $maxDistance: 1000000
            }
        }
    }).limit(10)
    res.send(stories)
})

/* This endpoint is for adding a new story. 
 The frontend sends lat/lng coordinates and Content/Text as JSON in the body of the request. 
 We parse this JSON using the "bodyParser" middleware and save it to MongoDB.
 see also: https://www.npmjs.com/package/body-parser  */
app.post('/api/story', mongoReady, (req, res) => {
    /* todo: insert new story into mongo */
    let story = new Story({
        "content": req.body.content,
        "location": req.body.location
    })
    story.save().then((status) => {
        res.send({
            "status": status
        })
    })
})

/* Delete endpoint for community moderation
   Anyone can remove offensive posts */
app.delete('/api/story/:id', mongoReady, async (req, res) => {
    try {
        const result = await Story.findByIdAndDelete(req.params.id)
        if (result) {
            res.send({ status: 'deleted', id: req.params.id })
        } else {
            res.status(404).send({ error: 'Story not found' })
        }
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete story' })
    }
})

/* Update endpoint for editing story content */
app.put('/api/story/:id', mongoReady, async (req, res) => {
    try {
        const result = await Story.findByIdAndUpdate(
            req.params.id,
            { content: req.body.content },
            { new: true } // return the updated document
        )
        if (result) {
            res.send({ status: 'updated', story: result })
        } else {
            res.status(404).send({ error: 'Story not found' })
        }
    } catch (err) {
        res.status(500).send({ error: 'Failed to update story' })
    }
})


const port = 3000
// Start Express
app.listen(port, () => {
    console.log(`Express is Live at http://localhost:${port}`);
}); 
