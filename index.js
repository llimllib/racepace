const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// The statute mile was standardised between the British Commonwealth and the
// United States by an international agreement in 1959, when it was formally
// redefined with respect to SI units as exactly 1,609.344 metres. -
// https://en.wikipedia.org/wiki/Mile
const METERS_PER_MILE = 1609.344;
const METERS_PER_MARATHON = 42195;

const SECONDS_HOUR = 3600;

const M_SP = /^(m|ms|meter|meters|metre|metres)$/i;
const KM_SP = /^(k|km|kms|kilometer|kilometers|kilometre|kilometres)$/i;
const MI_SP = /^(mi|mis|mile|miles)$/i;
const MARATHON = /^(marathon)$/i;
const HALF_MARATHON = /^(half marathon)$/i;

const EPSILON = 0.01;

// in the case where seconds = 1799.999999 -> seconds/60 = 29.999999999
// which we floor to 29, we want to actually round up. So if
// ceil(minutes) - minutes < epsilon, round up instead of down
function carefulFloor(n) {
  if (Math.ceil(n) - n < EPSILON) {
    return Math.ceil(n);
  }
  return Math.floor(n);
}

// convert a number of seconds into a reasonable output string for display.
// Will try to round numbers in a way that's intuitive
function displayTime(seconds) {
  const hours = carefulFloor(seconds / SECONDS_HOUR);
  seconds = Math.max(0, seconds - hours * SECONDS_HOUR);

  const minutes = carefulFloor(seconds / 60);
  const minutes_padded = ("" + minutes).padStart(2, "0");
  seconds = Math.max(0, seconds - minutes * 60);

  const seconds_padded = ("" + Math.round(seconds)).padStart(2, "0");

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    return "";
  }

  if (hours > 0) {
    return hours + ":" + minutes_padded + ":" + seconds_padded;
  } else {
    return minutes + ":" + seconds_padded;
  }
}

// given a unit string, return the number of meters in that unit
function parseUnit(input) {
  if (input.match(M_SP)) {
    return 1;
  } else if (input.match(KM_SP)) {
    return 1000;
  } else if (input.match(MI_SP)) {
    return METERS_PER_MILE;
  } else if (input.match(MARATHON)) {
    return METERS_PER_MARATHON;
  } else if (input.match(HALF_MARATHON)) {
    return METERS_PER_MARATHON / 2;
  }

  // If the unit is something like "500 meters", break it into n and a unit.
  // Doesn't allow nonsense like "2 marathons"
  const custom_dist = input.match(/([\d\.]+)\s*(\w*)/);
  if (custom_dist && custom_dist.length == 3) {
    const n = +custom_dist[1];
    const custom_unit = custom_dist[2];
    if (custom_unit.match(M_SP)) {
      return n;
    } else if (custom_unit.match(KM_SP)) {
      return n * 1000;
    } else if (custom_unit.match(MI_SP)) {
      return n * METERS_PER_MILE;
    }
  }
}

function parseInput(input) {
  let time_unit = input.split(/per|\//);
  if (time_unit.length < 2) {
    // We didn't find "x per unit" or "x/unit"; try "x unit", so that users can
    // say "3:00 marathon" or something like that
    time_unit = input.split(" ");
    if (time_unit.length < 2) {
      console.log("couldn't find a unit");
      return;
    }
    time_unit = [time_unit[0], time_unit.slice(1).join(" ")];
  }

  const [time, unit] = time_unit.map((x) => x.trim());

  // the number of meters in the unit given by the user
  const unitM = parseUnit(unit);

  let min_sec = time.split(":");
  if (min_sec.length < 2) {
    // if there is just an amount specified, assume it's seconds:
    //   85/400m -> 85 seconds per 400m
    const seconds = time.match(/(\d+)/);
    if (seconds) {
      min_sec = ["0", seconds[1]];
    } else {
      console.log("couldn't parse time", min_sec);
      return;
    }
  }

  let min = (sec = seconds = 0);
  if (min_sec.length == 2) {
    [min, sec] = min_sec.map((x) => parseFloat(x.trim()));
    seconds = min * 60 + sec;

    // If the seconds/M value is small, assume that the user meant
    // hours:minutes and not minutes:seconds
    if (seconds / unitM < 0.1) {
      seconds = min * SECONDS_HOUR + sec * 60;
    }
  } else if (min_sec.length == 3) {
    [hour, min, sec] = min_sec.map((x) => parseFloat(x.trim()));
    seconds = hour * 3600 + min * 60 + +sec;
  }

  return [unitM, seconds, seconds / unitM];
}

function calculateVdot(distanceM, timeS) {
  // t is time in minutes, v velocity in meters/minute
  // calculations from: https://www.omnicalculator.com/sports/vo2-max-runners
  const t = timeS / 60;
  const v = distanceM / t;

  const racevo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const vo2max =
    0.8 +
    0.1894393 * Math.pow(Math.E, -0.012778 * t) +
    0.2989558 * Math.pow(Math.E, -0.1932605 * t);

  return racevo2 / vo2max;
}

function clearAll() {
  $("#t200m").innerHTML = "";
  $("#t400m").innerHTML = "";
  $("#t1km").innerHTML = "";
  $("#t1mi").innerHTML = "";
  $("#t2mi").innerHTML = "";
  $("#t5km").innerHTML = "";
  $("#t10km").innerHTML = "";
  $("#t10mi").innerHTML = "";
  $("#thm").innerHTML = "";
  $("#tm").innerHTML = "";
  $("#vdot").innerHTML = "";
}

function handlePaceChange() {
  const val = $("#pace").value;
  const parseResult = parseInput(val);
  if (!parseResult) {
    clearAll();
    return;
  }

  const [distanceM, timeS, seconds_per_m] = parseResult;

  const vdot = calculateVdot(distanceM, timeS);
  $("#vdot").innerHTML = Math.round(vdot * 10) / 10;

  console.log("seconds per meter: ", seconds_per_m);

  $("#t200m").innerHTML = displayTime(seconds_per_m * 200);
  $("#t400m").innerHTML = displayTime(seconds_per_m * 400);
  $("#t1km").innerHTML = displayTime(seconds_per_m * 1000);
  $("#t1mi").innerHTML = displayTime(seconds_per_m * METERS_PER_MILE);
  $("#t2mi").innerHTML = displayTime(seconds_per_m * 2 * METERS_PER_MILE);
  $("#t5km").innerHTML = displayTime(seconds_per_m * 5000);
  $("#t10km").innerHTML = displayTime(seconds_per_m * 10000);
  $("#t10mi").innerHTML = displayTime(seconds_per_m * 10 * METERS_PER_MILE);
  $("#thm").innerHTML = displayTime(seconds_per_m * (METERS_PER_MARATHON / 2));
  $("#tm").innerHTML = displayTime(seconds_per_m * METERS_PER_MARATHON);
}

function useExample(evt) {
  console.log(evt);
  $("#pace").value = evt.target.innerText;
  handlePaceChange();
}

window.addEventListener("DOMContentLoaded", async (_evt) => {
  handlePaceChange();
  $("#pace").focus();
  $("#pace").addEventListener("change", handlePaceChange);
  // if we use keydown instead of keyup, we don't get the field after the
  // user's change
  $("#pace").addEventListener("keyup", handlePaceChange);
  $$("[data-example]").forEach((el) =>
    el.addEventListener("click", useExample)
  );
});
