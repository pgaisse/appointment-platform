require('dotenv').config();
const mongoose = require('mongoose');
const { Topic } = require('../models/Topic');
const { Column } = require('../models/Column');
const { Card } = require('../models/Card');

const uri = process.env.MONGO_URI ||
  `mongodb://${process.env.MONGO_USER || 'root'}:${process.env.MONGO_PASS || 'password'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || '27017'}/${process.env.MONGO_DB || 'productionDB'}?authSource=${process.env.MONGO_AUTH_SOURCE || 'admin'}`;

async function run() {
  await mongoose.connect(uri);
  //console.log('[seed] connected');

  await Topic.deleteMany({});
  await Column.deleteMany({});
  await Card.deleteMany({});

  const topic = await Topic.create({ title: 'Demo', key: 'DEMO' });
  const col1 = await Column.create({ topicId: topic._id, title: 'To Do', sortKey: '10' });
  const col2 = await Column.create({ topicId: topic._id, title: 'Doing', sortKey: '20' });
  const col3 = await Column.create({ topicId: topic._id, title: 'Done', sortKey: '30' });

  await Card.create({ topicId: topic._id, columnId: col1._id, title: 'Primera tarea', description: 'Descripción', sortKey: '10' });
  await Card.create({ topicId: topic._id, columnId: col2._id, title: 'En progreso', description: 'Detalle', sortKey: '10' });

  //console.log('[seed] done');
  await mongoose.disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
