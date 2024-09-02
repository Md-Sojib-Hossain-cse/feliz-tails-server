const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


app.get("/", async (req, res) => {
    res.send("Feliz Tails server is running .....");
})

app.listen(port, () => {
    console.log(`Feliz Tails server is running on port : ${port}`);
})