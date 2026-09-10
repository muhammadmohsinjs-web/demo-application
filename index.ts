const { format } = require('date-fns');

function formatCurrentDate(date = new Date()) {
  return format(date, 'PPpp');
}

console.log(`Current date and time: ${formatCurrentDate()}`);
