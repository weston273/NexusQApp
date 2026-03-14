const test = require('node:test');
const assert = require('node:assert/strict');
const validateRequest = require('../src/middleware/validateRequest');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test('validateRequest returns 400 when required field is missing', () => {
  const middleware = validateRequest(['email']);
  const req = { body: {} };
  const res = createRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { error: 'Missing required field: email' });
});

test('validateRequest calls next when required fields are present', () => {
  const middleware = validateRequest(['email', 'source']);
  const req = { body: { email: 'ops@example.com', source: 'ui' } };
  const res = createRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload, null);
});
