import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';

const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use('/api', routes);

console.log('Server running on port 3000');

const server = app.listen(3000);
