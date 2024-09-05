const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jnc3ejx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const reviewsCollection = client.db("felizTailsDB").collection("reviews");
        const petListingCollection = client.db("felizTailsDB").collection("petListing");

        app.get("/" ,async(req, res) => {
            res.send("Feliz Tails Server is running ...");
        })

        //pet listing related api
        app.get("/pet-listing" , async(req , res) => {
            const searchedCategory = req.query.category;
            const searchedName = req.query.name;
            const page = req.query.page;
            const limit = req.query.limit;
            let query = {};
            if(searchedCategory){
                query = {...query , category : searchedCategory};
            }
            if(searchedName){
                query = {...query , name : {$regex : searchedName , $options : "i"}};
            }
            const sortBy = {date : -1};
            const result = await petListingCollection.find(query).limit(page * limit).sort(sortBy).toArray();
            res.send(result);
        })

        //reviews related api
        app.get("/reviews" , async(req , res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);