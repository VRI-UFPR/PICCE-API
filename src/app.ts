import express from "express";
import bodyParser from "body-parser";
import routes from "./routes";
import path from "path";

const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use("/api", routes);
app.use("/uploads", express.static(path.basename("uploads")));

console.log("Server running on port 3000");

const server = app.listen(3000);
