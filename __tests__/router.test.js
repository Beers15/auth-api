'use strict';

process.env.SECRET = 'secret123';

const supertest = require('supertest');
const app = require('../src/server.js');
const server = supertest(app.server);
const jwt = require('jsonwebtoken');

const { db } =  require('../src/models');

beforeAll(async (done) => {
  await db.sync();
  done();
});

afterAll(async (done) => {
  await db.drop();
  done();
});

let users = {
  admin: { username: 'admin', password: 'password', role: 'admin' },
  editor: { username: 'editor', password: 'password', role: 'editor' },
  user: { username: 'user', password: 'password', role: 'user' },
  writer: { username: 'writer', password: 'password', role: 'writer' },
};

describe('Auth Router', () => {
  //auth routes
  it('can create a new user and sends an object with the user and the token to the client', async (done) => {
    const response = await server.post('/signup').send(users['user']);
    const userObject = response.body;

    //expect(response.status).toBe(201);
    expect(userObject.token).toBeDefined();
    expect(userObject.user.id).toBeDefined();
    expect(userObject.user.username).toEqual(users['user'].username);
    done();
  });

  it('can log in a user and sends an object with the user and token to the client', async (done) => {
    const response = await server.post('/signin')
      .auth(users['user'].username, users['user'].password);

    const userObject = response.body;
    expect(response.status).toBe(200);
    expect(userObject.token).toBeDefined();
    expect(userObject.user.id).toBeDefined();
    expect(userObject.user.username).toEqual(users['user'].username);
    done();
  });

  // //V1 (Unauthenticated API) routes 
  it('can add an item to the DB and returns an object with the added item (v1: non-auth route)', async (done) => {
    const body = {'name': 'apple', 'calories': '40', 'type': 'fruit'};
    const res = await server.post('/api/v1/food').send(body).set('Content-type', 'application/json');

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe(body.name);
    expect(res.body.calories).toBe(body.calories);
    expect(res.body.type).toBe(body.type);
    done();
  });

  it('can get a list of model items (v1: non-auth route)', async (done) => {
    const body = {'name': 'apple', 'calories': '40', 'type': 'fruit'};
    const body2 = {'name': 'apple2', 'calories': '400', 'type': 'fruit'};
    const body3 = {'name': 'apple3', 'calories': '4000', 'type': 'fruit'};
    await server.post('/api/v1/food').send(body).set('Content-type', 'application/json');
    await server.post('/api/v1/food').send(body2).set('Content-type', 'application/json');
    await server.post('/api/v1/food').send(body3).set('Content-type', 'application/json');
    
    const res = await server.get('/api/v1/food');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(2);
    done();
  });

  it('can get a specific model item (v1: non-auth route)', async (done) => {
    const body = {'name': 'apple', 'calories': 40, 'type': 'fruit'};
    const res = await server.get('/api/v1/food/1');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe(body.name);
    expect(res.body.calories).toBe(body.calories);
    expect(res.body.type).toBe(body.type);
    done();
  });

  it('can update a specific model item and return it (v1: non-auth route)', async (done) => {
    const body = {'name': 'mango', 'calories': 40, 'type': 'fruit'};
    const res = await server.get('/api/v1/food/1');
    expect(res.body.name).toBe('apple');

    const res2 = await server.put('/api/v1/food/1').send(body);
    expect(res2.body.name).toBe('mango');

    done();
  });

  it('can delete a specific model item and return an empty object (v1: non-auth route)', async (done) => {
      let res = await server.delete('/api/v1/food/1');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({});
      done();
  });

  // //V2 (Authenticated API) routes 
  it('can add an item to the DB and returns an object with the added item if user has create permissions (v2: auth route)', async (done) => {
    const token = jwt.sign(users['writer'], process.env.SECRET);
    await server.post('/signup').send(users['writer']);
    
    const body = {'name': 'orange', 'calories': '40', 'type': 'fruit'};

    const res = await server.post('/api/v2/food')
      .set('Authorization', 'Bearer ' + token).send(body)

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe(body.name);
    expect(res.body.calories).toBe(body.calories);
    expect(res.body.type).toBe(body.type);


    const token2 = jwt.sign(users['user'], process.env.SECRET);
    await server.post('/signup').send(users['user']);

    const res2 = await server.post('/api/v2/food')
    .set('Authorization', 'Bearer ' + token2).send(body)
    
    expect(res2.statusCode).toBe(500);

    done();
  });

  it('can get a list of model items if user has read permissions (v2: auth route)', async (done) => {
    const body = {'name': 'apple', 'calories': '40', 'type': 'fruit'};
    const body2 = {'name': 'apple2', 'calories': '400', 'type': 'fruit'};
    const body3 = {'name': 'apple3', 'calories': '4000', 'type': 'fruit'};
    await server.post('/api/v1/food').send(body).set('Content-type', 'application/json');
    await server.post('/api/v1/food').send(body2).set('Content-type', 'application/json');
    await server.post('/api/v1/food').send(body3).set('Content-type', 'application/json');

    const token = jwt.sign(users['user'], process.env.SECRET);
    await server.post('/signup').send(users['user']);
 
    const res = await server.get('/api/v2/food')
      .set('Authorization', 'Bearer ' + token)
    
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(2);
    done();
  });

  it('can get a specific model item if user has read permissions (v2: auth route)', async (done) => {
      const body = {'name': 'apple', 'calories': 40, 'type': 'fruit'};

      const token = jwt.sign(users['user'], process.env.SECRET);

      const res = await server.get('/api/v2/food/1').set('Authorization', 'Bearer ' + token);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe(body.name);
      expect(res.body.calories).toBe(body.calories);
      expect(res.body.type).toBe(body.type);
      done();
  });

  it('can update a specific model item and return it if user has update permissions (v2: auth route)', async (done) => {
    const token = jwt.sign(users['editor'], process.env.SECRET);
    await server.post('/signup').send(users['editor']);

    const body = {'name': 'mango', 'calories': 40, 'type': 'fruit'};
    const res = await server.get('/api/v2/food/2').set('Authorization', 'Bearer ' + token);
    expect(res.body.name).toBe('apple');

    const res2 = await server.put('/api/v2/food/2').set('Authorization', 'Bearer ' + token).send(body);
    expect(res2.body.name).toBe('mango');

    done();
  });

  it('can delete a specific model item and return an empty object if user has delete permissions (v2: auth route)', async (done) => {
    const token = jwt.sign(users['admin'], process.env.SECRET);
    await server.post('/signup').send(users['admin']);

    let res = await server.delete('/api/v2/food/2').set('Authorization', 'Bearer ' + token);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({});
    done();
  });
});

