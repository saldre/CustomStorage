

/**
 * CustomStorage is an interface for localStorage with a few useful tweaks:
 *
 * 1. Storing plain objects (without methods) is supported by automatically
 *    converting them to JSON strings and decoding upon retrieval.
 * 2. Keys will be automatically prefixed with the specified keyword.
 *    This avoids naming clashes between, say, different parts of the
 *    system wanting to store data under the same name.
 * 3. Stored objects can be merged with new data, rather than be overwritten, if need be.
 * 4. Fallback to object based storage if the browser doesn't support localStorage.
 * 5. Option to specify expiration time. Requires Moment.js.
 *
 * Usage:
 *
 * var storage = new CustomStorage('prefixName');
 * storage.set('foo', 'bar');
 * storage.get('foo');  // Returns 'bar'
 * storage.erase('foo');
 * storage.get('foo');  // Returns null
 *
 * storage.set('obj', { foo: true, baz: 2 });
 * storage.get('obj').baz;  // Returns 2
 * storage.set('obj', { baz: 5 }, { merge: true });
 * storage.merge('obj', { baz: 5});  // Shortcut for previous line
 * storage.get('obj');  // Returns { foo: true, baz: 5 }
 *
 * storage.set('timed-data', 'foo', { expiresIn: '2 minutes' });
 * storage.get('timed-data');  // Returns "foo" for only 2 minutes.
 *
 * @author Mattias Saldre
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
 * Merges properties from the second object into the first one.
 *
 * @param {Object} source
 * @param {Object} other
 * @return {Object}
 */
function extend(source, other) {
  for ( var property in other ) {
    if ( other.hasOwnProperty(property) ) {
      source[property] = other[property];
    }
  }

  return source;
}

(function() {
  var UNITS = CustomStorage.TIME_UNITS = {
    SECOND: 1000
  };

  UNITS.MINUTE = 60 * UNITS.SECOND;
  UNITS.HOUR = 60 * UNITS.MINUTE;
  UNITS.DAY = 24 * UNITS.HOUR;
  UNITS.WEEK = 7 * UNITS.DAY;
  UNITS.MONTH = 30 * UNITS.DAY;
  UNITS.YEAR = 365 * UNITS.DAY;
})();


/**
 * Calculates timestamp when the data will be considered to be expired.
 *
 * The string format is "amount timeUnit", e.g.:
 *   "30 minutes"
 *   "1 day"
 *   "5 months
 *   "2 years"
 *
 * @param {String} expiresIn
 * @return {Number}
 */
CustomStorage.calculateExpirationTimestamp = function(expiresIn) {
  var now = +new Date;

  return now + CustomStorage.convertExpirationStringToMilliseconds(expiresIn);
};


/**
 * @param {String} expiresIn
 * @return {Number}
 */
CustomStorage.convertExpirationStringToMilliseconds = function(expiresIn) {
  var amount = expiresIn.split(' ')[0];
  var timeUnit = expiresIn.split(' ')[1];

  return amount * CustomStorage.convertTimeUnitToMilliseconds(timeUnit);
};


/**
 * @param {String} timeUnit
 * @return {String}
 */
CustomStorage.normalizeTimeUnit = function(timeUnit) {
  return timeUnit.replace(/s$/, '').toUpperCase();
};


/**
 * @param {String} timeUnit
 * @return {Number}
 */
CustomStorage.convertTimeUnitToMilliseconds = function(timeUnit) {
  return CustomStorage.TIME_UNITS[CustomStorage.normalizeTimeUnit(timeUnit)];
};


/**
 * Stores the value under the specified key.
 *
 * @param {String} key
 * @param {*} value
 * @param {Object} [options]
 */
CustomStorage.prototype.set = function(key, value, options) {
  options = extend({
    expiresIn: false,
    merge: false
  }, options);

  // Create a container object to allow embedding meta
  // data in addition to the actual data.
  var storageItem = {
    data: value
  };

  // Stored objects can be merged with new info.
  if ( options.merge ) {
    storageItem.data = extend(this.get(key) || {}, value);
  }

  if ( typeof options.expiresIn == 'string' ) {
    storageItem.expiresAt = CustomStorage.calculateExpirationTimestamp(options.expiresIn);
  }

  this.driver.setItem(this.prefixKey(key), JSON.stringify(storageItem));
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
 * @return {*}
 */
CustomStorage.prototype.get = function(key) {

  if ( !this.keyExists(key) ) {
    return null;
  }

  var storageItem = JSON.parse(this.driver.getItem(this.prefixKey(key)));

  if ( this.isExpired(storageItem) ) {
    this.erase(key);
    return null;
  }

  return storageItem && storageItem.data;
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
  options = extend({
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


/**
 * Checks if the specified key exists.
 *
 * @param {String} key
 * @return {Boolean}
 */
CustomStorage.prototype.keyExists = function(key) {
  return !!this.driver.getItem(this.prefixKey(key));
};


/**
 * Checks if the stored item has expired.
 *
 * @param {Object} storageItem
 * @return {Boolean}
 */
CustomStorage.prototype.isExpired = function(storageItem) {

  if ( !storageItem ) {
    return false;
  }

  return storageItem.expiresAt < +new Date;
};
