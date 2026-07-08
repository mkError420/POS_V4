// Setup global BD timezone overrides for JavaScript Date
(function() {
  const OriginalDate = window.Date;

  function PatchedDate(...args) {
    if (args.length === 1 && typeof args[0] === 'string') {
      let s = args[0].trim();
      // Match YYYY-MM-DD HH:mm:ss
      if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(s)) {
        args[0] = s.replace(' ', 'T') + '+06:00';
      }
      // Match YYYY-MM-DD HH:mm
      else if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) {
        args[0] = s.replace(' ', 'T') + ':00+06:00';
      }
      // Match YYYY-MM-DD
      else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        args[0] = s + 'T00:00:00+06:00';
      }
      // Match YYYY-MM-DDTHH:mm:ss without timezone
      else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
        args[0] = s + '+06:00';
      }
    }

    if (new.target) {
      return new OriginalDate(...args);
    }
    return OriginalDate(...args);
  }

  // Copy static properties and prototypes
  PatchedDate.prototype = OriginalDate.prototype;
  
  // Copy all static properties of Date
  Object.getOwnPropertyNames(OriginalDate).forEach(key => {
    if (key !== 'prototype' && key !== 'name' && key !== 'length') {
      Object.defineProperty(PatchedDate, key, Object.getOwnPropertyDescriptor(OriginalDate, key));
    }
  });

  const originalParse = OriginalDate.parse;
  PatchedDate.parse = function(str) {
    if (typeof str === 'string') {
      let s = str.trim();
      if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + '+06:00';
      } else if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + ':00+06:00';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        s = s + 'T00:00:00+06:00';
      } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
        s = s + '+06:00';
      }
      return originalParse(s);
    }
    return originalParse(str);
  };

  // Add custom method to format Date object into YYYY-MM-DD in Asia/Dhaka
  OriginalDate.prototype.toBDISODateString = function() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(this);
  };

  // Override toLocaleString, toLocaleDateString, toLocaleTimeString to default to Asia/Dhaka
  const originalToLocaleString = OriginalDate.prototype.toLocaleString;
  OriginalDate.prototype.toLocaleString = function(locales, options) {
    const opts = { timeZone: 'Asia/Dhaka', ...options };
    return originalToLocaleString.call(this, locales, opts);
  };

  const originalToLocaleDateString = OriginalDate.prototype.toLocaleDateString;
  OriginalDate.prototype.toLocaleDateString = function(locales, options) {
    const opts = { timeZone: 'Asia/Dhaka', ...options };
    return originalToLocaleDateString.call(this, locales, opts);
  };

  const originalToLocaleTimeString = OriginalDate.prototype.toLocaleTimeString;
  OriginalDate.prototype.toLocaleTimeString = function(locales, options) {
    const opts = { timeZone: 'Asia/Dhaka', ...options };
    return originalToLocaleTimeString.call(this, locales, opts);
  };

  window.Date = PatchedDate;
})();
