const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const bundler = require('./bundler');

const app = express();
let db;

// Express config
app.use(cors());
app.use(bodyParser.json());

// Routes
app.post('/apps', (req, res) => {
  const application = {
    name: req.body.name,
    files: [],
  };
  db.collection('applications')
    .insertOne(application)
    .then(() => {
      return res.json(application);
    });
});

app.get('/apps', (req, res) => {
  db.collection('applications')
    .find({})
    .toArray()
    .then((applications) => {
      return res.json(applications);
    });
});

app.get('/apps/:appId', (req, res) => {
  db.collection('applications')
    .findOne({ _id: new ObjectID(req.params.appId )})
    .then((application) => {
      return res.json(application);
    });
});

app.post('/apps/:appId/files', (req, res) => {
  const file = {
    dir: req.body.dir || '/',
    base: req.body.base,
    content: req.body.content || '',
    package: new ObjectID(req.params.appId),
  };
  db.collection('files')
    .findOne({
      dir: file.dir,
      base: file.base,
      package: file.package,
    })
    .then((existingFile) => {
      if (existingFile) {
        throw new Error('File already exists');
      }
      return db.collection('files').insertOne(file);
    })
    .then(() => {
      return db.collection('applications')
        .findOneAndUpdate(
          { _id: new ObjectID(req.params.appId) },
          { $push: { files: file._id } },
          { returnOriginal: false }
        );
    })
    .then((result) => {
      const appDefinition = result.value;
      generateBundle(appDefinition);
      return res.status(201).json(file);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).json({ error: err.message });
    });
});

app.get('/apps/:appId/files', (req, res) => {
  db.collection('applications')
    .findOne({ _id: new ObjectID(req.params.appId) })
    .then((application) => {
      return db.collection('files')
        .find({ _id: { $in: application.files } })
        .toArray();
    })
    .then((files) => {
      return res.json(files);
    });
});

app.patch('/files/:fileId', (req, res) => {
  db.collection('files')
    .findOneAndUpdate(
      { _id: new ObjectID(req.params.fileId) },
      { $set: req.body || {} },
      { returnOriginal: false }
    )
    .then((result) => {
      const file = result.value;
      db.collection('applications')
        .findOne({ _id: file.package })
        .then((appDefinition) => {
          generateBundle(appDefinition);
        });
      return res.status(204).send();
    });
});

// DB connection
const url = 'mongodb://localhost:27017/bappo-coding';
MongoClient.connect(url)
  .then((_db) => {
    db = _db;
    console.log('connected to mongodb');

    app.listen(process.env.PORT || 8080);
  })
  .catch(err => console.log(err));

function generateBundle(appDefinition) {
  return db.collection('files')
    .find({ _id: { $in: appDefinition.files } })
    .toArray()
    .then((files) => {
      return bundler(appDefinition._id, files);
    })
    .then((bundle) => {
      db.collection('applications')
        .findOneAndUpdate(
          { _id: appDefinition._id },
          { $set: { bundle } }
        );
    });
}
