import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config';
import { errorHandler, apiLimiter } from './middleware';
import routes from './routes';
import { setupSocket } from './socket';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(errorHandler);

setupSocket(httpServer);

httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT}`);
});
