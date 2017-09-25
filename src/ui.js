import {GPedalDisplay} from './GPedalDisplay';
import {GPXRoutePointFactory} from './Route';
import {fileRead, readCharacteristicValue} from './lib/utils';
import {credentials} from "./lib/oauth";
import {VirtualPowerMeter, BlePowerCadenceMeter, BleCadenceMeter,
    BlePowerMeter, BleHRMeter, CyclingPowerMeasurementParser} from './Meter';
import URLSearchParams from 'url-search-params';

function getInProgressRoutes() {
  return JSON.parse(localStorage.getItem('route-progress')) || [];
}

function unshiftInProgressRoute(mapDisplay) {
  let routes = getInProgressRoutes();
  routes = routes.filter(r => r !== mapDisplay.cacheName());
  routes.unshift(mapDisplay.cacheName());
  localStorage.setItem('route-progress', JSON.stringify(routes));
}

function removeInProgressRoute(mapDisplay) {
  let routes = getInProgressRoutes();
  routes = routes.filter(r => r !== mapDisplay.cacheName());
  localStorage.removeItem(mapDisplay.cacheName());
  localStorage.setItem('route-progress', JSON.stringify(routes));
}

function addInProgressRoute(mapDisplay) {
  let routes = getInProgressRoutes();

  routes.unshift(mapDisplay.cacheName());
  if(routes.length > 3) {
    let id = routes.shift();
    localStorage.removeItem(id);
  }

  localStorage.setItem('route-progress', JSON.stringify(routes));
}

export function registerUI() {
  let thisLocationURL = new URL(window.location);
  let params = new URLSearchParams(thisLocationURL.search);
  if(params.get('state') && params.get('code')) {
    let code = params.get('code');
    localStorage.setItem('strava-oauth-code-' + credentials.STRAVA_CLIENT_ID, code);
    window.location.assign('/');
    return;
  }

  let proto = window.location.protocol;
  if(proto !== 'https:') {
    let host = window.location.host;
    let self = 'https://' + host + '/';
    window.location.assign(self);
  }

  if(credentials.STRAVA_CLIENT_ID === undefined || credentials.STRAVA_CLIENT_ID === null || credentials.STRAVA_CLIENT_ID === '') {
    document.getElementById('container-strava').style.display = 'none';
  }

  if(localStorage.getItem('strava-oauth-code-' + credentials.STRAVA_CLIENT_ID)) {
    document.getElementById('strava-btn-connect').style.display = 'none';
    document.getElementById('strava-btn-connected').style.display = 'block';
  }

  if (typeof navigator !== 'undefined' && "bluetooth" in navigator) {
    // web bluetooth available
    document.getElementById('btn-bluetooth-device').style.display = 'inline-block';
    document.getElementById('btn-bluetooth-device-warning').style.display = 'none';
  } else {
    document.getElementById('btn-bluetooth-device').style.display = 'none';
    document.getElementById('btn-bluetooth-device-warning').style.display = 'block';
  }

  let routes = getInProgressRoutes();
  let $previous = document.getElementById('continue-previous');
  for(let r of routes) {
    var $option = document.createElement("option");
    let route = JSON.parse(localStorage.getItem(r));
    let routeDate = new Date();
    routeDate.setTime(route.id);

    $option.innerHTML = routeDate.toLocaleDateString() + " " + routeDate.toLocaleTimeString() + " - " + route.routeName;
    $option.setAttribute('value', r);
    $previous.add($option);
  }

  let powerMeters = [
    ['virtual', new VirtualPowerMeter()]
  ]

  let heartMeters = []

  let cadenceMeters = []

  let mapDisplay;

  let $gpx = document.getElementById('gpx-file-upload');
  let $unit = document.getElementById('display-unit');
  let $weight = document.getElementById('rider-weight');
  let $btn = document.getElementById('begin-session');
  let $btntxt = document.getElementById('btn-bluetooth-device-txt');
  let $stva = document.getElementById('strava-btn-connect');
  let $blt = document.getElementById('btn-bluetooth-device');
  let $pm = document.getElementById('power-meter');
  let $hm = document.getElementById('hr-meter');
  let $cm = document.getElementById('cadence-meter');
  let $mob = document.getElementById('menuopen-btn');

  /**
  Route tab switching handler
  */
  for(let $a of document.querySelectorAll('#route-nav a')) {
    $a.onclick = (e) => {
      e.preventDefault();
      let selector = e.target.getAttribute('href');

      for(let $p of document.querySelectorAll('.nav-link')) {
        $p.classList.remove('active');
      }
      e.target.classList.add('active');

      for(let $p of document.querySelectorAll('.tab-pane')) {
        $p.classList.remove('active');
      }
      document.querySelector(selector).classList.add('active');
    };
  }

  /**
  Unit change Handler
  */
  $unit.onchange = (e) => {
    if($unit.value === 'imperial') {
      document.getElementById('rider-weight-label').innerHTML = 'Rider Weight (lbs)';
      document.getElementById('rider-weight').setAttribute('placeholder', 185);
    } else {
      document.getElementById('rider-weight-label').innerHTML = 'Rider Weight (kg)';
      document.getElementById('rider-weight').setAttribute('placeholder', 85);
    }
  };

  /**
  Menu open Handler
  */
  $mob.onclick = (e) => {
    e.preventDefault();
    if(document.getElementById('ui-finalize-container').style.display === 'none') {
      mapDisplay.showFinalizeUI("Complete Ride");
    } else {
      document.getElementById('ui-finalize-container').style.display = 'none';
    }
  };

  /**
  Strava Connect Handler
  */
  $stva.onclick = (e) => {
    e.preventDefault();

    let proto = window.location.protocol;
    let host = window.location.host;
    let self = proto + '//' + host + '/';

    window.location.assign("https://www.strava.com/oauth/authorize?client_id=" + credentials.STRAVA_CLIENT_ID + "&response_type=code&redirect_uri="+self+"&scope=write&state=strava");
  };

  /**
  Bluetooth Button Handler
  */
  $blt.onclick = (e) => {
    e.preventDefault();

    if(!$blt.classList.contains('disabled')) {
      $blt.classList.add('disabled');
    } else {
      return;
    }

    $btntxt.innerHTML = "Connecting ...";
    (async function() {
      let device = await navigator.bluetooth.requestDevice({
        filters: [
          // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.service.heart_rate.xml
          {services: [0x180D]},
          // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.service.cycling_power.xml
          {services: [0x1818]},
          // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.service.cycling_speed_and_cadence.xml
          {services: [0x1816]}]
      });
      let server = await device.gatt.connect();

      let services = await server.getPrimaryServices();
      for(let service of services) {
        let serviceId = parseInt(service.uuid.substring(0,8), 16);
        if(serviceId === 0x1818) {
          // org.bluetooth.service.cycling_power

          if(powerMeters.find(m => m[0] === device.id)) {
            continue;
          }

          let characteristic = await service.getCharacteristic(0x2A63);
          let parser = new CyclingPowerMeasurementParser();
          let value = await readCharacteristicValue(characteristic);
          let data = parser.getData(value);

          // is Crank Revolution Data Present ?
          if('cumulative_crank_revolutions' in data) {
            let meter = new BlePowerCadenceMeter(device, server, service, characteristic);
            powerMeters.push([meter.id, meter]);
            cadenceMeters.push([meter.id, meter]);
          } else {
            let powerMeter = new BlePowerMeter(device, server, service, characteristic);
            powerMeters.push([powerMeter.id, powerMeter]);
          }
        } else if(serviceId === 0x1816) {
          // org.bluetooth.service.cycling_speed_and_cadence

          if(cadenceMeters.find(m => m[0] === device.id)) {
            continue;
          }

          let characteristic = await service.getCharacteristic(0x2A5B);
          let cadenceMeter = new BleCadenceMeter(device, server, service, characteristic);
          cadenceMeters.push([cadenceMeter.id, cadenceMeter]);
        } else if(serviceId === 0x180D) {
          // org.bluetooth.service.heart_rate

          if(heartMeters.find(m => m[0] === device.id)) {
            continue;
          }

          let characteristic = await service.getCharacteristic(0x2A37);
          let hrMeter = new BleHRMeter(device, server, service, characteristic);
          heartMeters.push([hrMeter.id, hrMeter]);
        }
      }

      $pm.options.length = 0;
      for(let [key, pm] of powerMeters) {
        var $option = document.createElement("option");
        $option.innerHTML = pm.name;
        $option.setAttribute('value', pm.id);
        if(pm.id === device.id) {
          $option.setAttribute('selected', 'true');
        }
        $pm.add($option);
      }

      //

      $hm.options.length = 0;
      for(let [key, hm] of heartMeters) {
        var $option = document.createElement("option");
        $option.innerHTML = hm.name;
        $option.setAttribute('value', hm.id);
        if(hm.id === device.id) {
          $option.setAttribute('selected', 'true');
        }
        $hm.options.add($option);
      }

      if($hm.options.length === 0) {
        var $option = document.createElement("option");
        $option.innerHTML = 'Disabled';
        $option.setAttribute('value', '');
        $hm.options.add($option);
      }

      //

      $cm.options.length = 0;
      for(let [key, cm] of cadenceMeters) {
        var $option = document.createElement("option");
        $option.innerHTML = cm.name;
        $option.setAttribute('value', cm.id);
        if(cm.id === device.id) {
          $option.setAttribute('selected', 'true');
        }
        $cm.options.add($option);
      }

      if($cm.options.length === 0) {
        var $option = document.createElement("option");
        $option.innerHTML = 'Disabled';
        $option.setAttribute('value', '');
        $cm.options.add($option);
      }

      $blt.classList.remove('disabled');
      $btntxt.innerHTML = "Connect";
    })()
    .catch(error => {
      $blt.classList.remove('disabled');
      $btntxt.innerHTML = "Connect";
      console.log("Error: ", error);
    });
  };

  /**
  Begin Button Handler
  */
  $btn.onclick = (e) => {
    e.preventDefault();

    if(($gpx.value || $previous.value) && $weight.value) {
      if(!$btn.classList.contains('disabled')) {
        $btn.classList.add('disabled');
      } else {
        return;
      }

      (async function() {
        let riderWeight = $weight.value;
        let unit = $unit.value;

        let powerMeterID = $pm.value;
        let powerMeter = powerMeters.find(m => m[0] === powerMeterID)[1];
        powerMeter.listen();

        let heartMeterID = $hm.value;
        let heartMeter;
        if(heartMeterID) {
          heartMeter = heartMeters.find(m => m[0] === heartMeterID)[1];
          heartMeter.listen();
        }

        let cadenceMeterID = $cm.value;
        let cadenceMeter;
        if(cadenceMeterID) {
          cadenceMeter = cadenceMeters.find(m => m[0] === cadenceMeterID)[1];
          cadenceMeter.listen();
        }

        localStorage.setItem('form-weight', riderWeight);
        localStorage.setItem('form-unit', unit);

        GPedalDisplay.transitionUI();

        if($previous.value) {
          let raw = JSON.parse(localStorage.getItem($previous.value));
          mapDisplay = GPedalDisplay.fromJSON(raw);
          mapDisplay.powerMeter = powerMeter;
          mapDisplay.heartMeter = heartMeter;
          mapDisplay.cadenceMeter = cadenceMeter;

          unshiftInProgressRoute(mapDisplay);
        } else {
          let fileBody = await fileRead($gpx.files[0]);
          let factory = new GPXRoutePointFactory(fileBody);
          let points = await factory.create();

          mapDisplay = new GPedalDisplay({points, riderWeight, unit, powerMeter, heartMeter, cadenceMeter});
          addInProgressRoute(mapDisplay);
        }

        await mapDisplay.init();

        mapDisplay.updateUI();
        await mapDisplay.updatePosition();
        removeInProgressRoute(mapDisplay);
        mapDisplay.showFinalizeUI("Ride Finished");
      })()
      .catch(error => {
        console.log("Error: ", error);
      });
    } else {
      let msg = '';
      if(!$gpx.value && !$previous.value) {
        msg = 'Please select a GPX file.';
      } else if(!$weight.value) {
        msg = 'Please enter the riders weight.';
      }

      let $msg = document.getElementById('messages');
      $msg.innerHTML = msg;
      $msg.style.display = 'block';

      window.scrollTo(0, 0);
    }
  };

  if(localStorage.getItem('form-weight')) {
    $weight.value = localStorage.getItem('form-weight');
  }

  if(localStorage.getItem('form-unit')) {
    $unit.value = localStorage.getItem('form-unit');
    $unit.onchange();
  }
}
