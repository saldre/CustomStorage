CustomStorage is an interface for localStorage with a few useful tweaks:

1. Storing plain objects (without methods) is supported by automatically converting them to JSON strings and decoding upon retrieval.
2. Keys will be automatically prefixed with the specified keyword. This avoids naming clashes between, say, different parts of the system wanting to store data under the same name.
3. Stored objects can be merged with new data, rather than be overwritten, if need be.
4. Fallback to object based storage if the browser doesn't support localStorage.
5. Option to specify expiration time. Requires Moment.js.

Usage:

var storage = new CustomStorage('prefixName');

storage.set('foo', 'bar');
storage.get('foo');  // Returns 'bar'
storage.erase('foo');
storage.get('foo');  // Returns null

storage.set('obj', { foo: true, baz: 2 });
storage.get('obj').baz;  // Returns 2
storage.set('obj', { baz: 5 }, { merge: true });
storage.merge('obj', { baz: 5});  // Shortcut for previous line
storage.get('obj');  // Returns { foo: true, baz: 5 }

storage.set('timed-data', 'foo', { expiresIn: '2 minutes' });
storage.get('timed-data');  // Returns "foo" for only 2 minutes.
