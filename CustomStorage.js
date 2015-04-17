

/**
 * CustomStorage is an interface for localStorage with a few useful tweaks:
 *
 * 1. Storing plain objects (without methods) will automatically
 *    convert them to JSON strings and decode upon retrieval.
 * 2. Keys will be automatically prefixed with the specified keyword.
 *    This avoids naming clashes between, say, different parts of the
 *    system wanting to store data under the same name.
 * 3. Stored objects can be merged with new data, rather than be overwritten, if need be.
 * 4. Fallback to object based storage if the browser doesn't support localStorage.
 *
 * Usage:
 *
 * var storage = new CustomStorage('prefixName');
 * storage.set('foo', 'bar');
 * storage.get('foo'); // Returns 'bar'
 * storage.erase('foo');
 * storage.get('foo'); // Returns null
 *
 * storage.set('obj', { foo: true, baz: 2 });
 * storage.get('obj').baz; // Returns 2
 * storage.set('obj', { baz: 5 }, { merge: true });
 * storage.merge('obj', { baz: 5}); // Shortcut for previous line
 * storage.get('obj'); // Returns { foo: true, baz: 5 }
 *
 * @param {String} prefix
 * @constructor
 */
function CustomStorage(prefix) {

  if ( !prefix ) {
    console.warn('CustomStorage: prefix not set.');
    return;
  }

  var driver = 'localStorage';
  this.driver = window[driver];
  this.prefix = prefix;

  // Fall back to object based approach if the browser does not support the selected
  // driver, rather than using cookies, since they only support 4KB of information
  // per domain. One mid-sized JSON object and you're already near maxing out any
  // information storing possibility for the current domain.
  if ( !this.driver ) {
    console.warn([
      'CustomStorage: ',
      driver + ' not supported by the browser, using object based storage.',
      'Note that this does not store data in-between page loads.'
    ].join(' '));

    this.driver = {
      cache: {},

      setItem: function(key, value) {
        this.cache[key] = value;
      },
      getItem: function(key) {
        return this.cache[key];
      },
      removeItem: function(key) {
        delete this.cache[key];
      }
    };
  }
}


/**
 * Stores the value under the specified key.
 *
 * @param {String} key
 * @param {*} value
 * @param {Object} [options]
 */
CustomStorage.prototype.set = function(key, value, options) {
  options = $.extend({
    merge: false
  }, options);

  // Stored objects can be merged with new info.
  if ( options.merge && $.isPlainObject(this.get(key)) ) {
    value = $.extend(this.get(key) || {}, value);
  }

  // Objects are converted to JSON format.
  if ( $.isPlainObject(value) ) {
    value = JSON.stringify(value);
  }

  this.driver.setItem(this.prefixKey(key), value);
};


/**
 * Merges the specified data with the currently saved data. Works only with objects.
 *
 * @param {String} key
 * @param {Object} obj
 */
CustomStorage.prototype.merge = function(key, obj) {
  this.set(key, obj, { merge: true });
};


/**
 * Retrieves the value under the specified key.
 *
 * @param {String} key
 */
CustomStorage.prototype.get = function(key) {
  var value = this.driver.getItem(this.prefixKey(key));

  // Decode objects stored in JSON format.
  try {
    value = JSON.parse(value);
  } catch(e) {}

  return value;
};


/**
 * Removes the data under the specified key.
 *
 * @param {String} key
 */
CustomStorage.prototype.erase = function(key) {
  this.driver.removeItem(this.prefixKey(key));
};


/**
 * Executes the callback only if the specified key exists.
 *
 * @param {String} key
 * @param {Function} callback
 * @param {Object} [options]
 */
CustomStorage.prototype.executeOnKey = function(key, callback, options) {
  var value = this.get(key);
  options = $.extend({
    erase: false
  }, options);

  if ( value && typeof callback == 'function' ) {
    callback(value);
  }

  if ( options.erase ) {
    this.erase(key);
  }
};


/**
 * Prefixes the key with the... well, prefix.
 *
 * @param {String} key
 * @return {String}
 */
CustomStorage.prototype.prefixKey = function(key) {
  return this.prefix + ':' + key;
};
