import {GPedalDisplay} from './GPedalDisplay';
import {GPXRoutePointFactory} from './Route';
import {fileRead, readCharacteristicValue} from './lib/utils';
import {credentials} from "./lib/oauth";
import {VirtualPowerMeter, BlePowerCadenceMeter, BleCadenceMeter,
    BlePowerMeter, BleHRMeter, CyclingPowerMeasurementParser, AntMeterLocator} from './Meter';
import {managedLocalStorage} from './lib/managedLocalStorage';
import URLSearchParams from 'url-search-params';
import fscreen from 'fscreen';


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
  let isBle = (proto === 'https:');

  if(proto !== 'https:' && params.get('useant') !== 'true') {
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

  let routes = managedLocalStorage.container('route-progress');
  let $previous = document.getElementById('continue-previous');
  for(let r of routes) {
    try {
      let route = managedLocalStorage.get(r);
      var $option = document.createElement("option");
      let routeDate = new Date();
      routeDate.setTime(route.id);

      $option.innerHTML = routeDate.toLocaleDateString() + " " + routeDate.toLocaleTimeString() + " - " + route.routeName;
      $option.setAttribute('value', r);
      $previous.add($option);
    } catch(err) {
      // Is data stored in old format?  Clear localStorage and reload.
      localStorage.clear();
      location.reload();
      break;
    }
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
  let $atntxt = document.getElementById('btn-ant-device-txt');
  let $stva = document.getElementById('strava-btn-connect');
  let $blt = document.getElementById('btn-bluetooth-device');
  let $alt = document.getElementById('btn-ant-device');
  let $pm = document.getElementById('power-meter');
  let $hm = document.getElementById('hr-meter');
  let $cm = document.getElementById('cadence-meter');
  let $mob = document.getElementById('menuopen-btn');
  let $fsc = document.getElementById('btn-fullscreen');
  let $blecontainer = document.getElementById('bluetooth-device-container');
  let $antcontainer = document.getElementById('ant-device-container');
  let $antwsurl = document.getElementById('ant-ws-url');

  let redrawMeters = device => {
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
    if($pm.value === 'virtual' && powerMeters.length > 1) {
      $pm.options[1].setAttribute('selected', 'true');
    }

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
  };

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

  document.getElementById('btn-useant').onclick = (e) => {
    e.preventDefault();

    let host = window.location.host;
    let self = 'http://' + host + '/?useant=true';
    window.location.assign(self);
  };

  document.getElementById('btn-useble').onclick = (e) => {
    e.preventDefault();

    let host = window.location.host;
    let self = 'https://' + host + '/';
    window.location.assign(self);
  };

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
  Fullscreen button
  */
  $fsc.onclick = (e) => {
    e.preventDefault();

    if (fscreen.fullscreenElement !== null) {
      fscreen.exitFullscreen();
    } else {
      fscreen.requestFullscreen(document.body);
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

    if (typeof navigator === 'undefined' || !("bluetooth" in navigator)) {
      // web bluetooth not available
      document.getElementById('btn-bluetooth-device').style.display = 'none';
      document.getElementById('btn-bluetooth-device-warning').style.display = 'block';
      return;
    }

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

      let meter = undefined;
      // org.bluetooth.service.cycling_power
      if(!powerMeters.find(m => m[0] === device.id)) {
        let service = undefined;
        try {
          service = await server.getPrimaryService(0x1818);
        } catch(error){}

        if(service) {
          let characteristic = await service.getCharacteristic(0x2A63);
          let parser = new CyclingPowerMeasurementParser();
          let value = await readCharacteristicValue(characteristic);
          let data = parser.getData(value);

          // is Crank Revolution Data Present ?
          if('cumulative_crank_revolutions' in data) {
            meter = new BlePowerCadenceMeter(device, server, service, characteristic);
            powerMeters.push([meter.id, meter]);
            cadenceMeters.push([meter.id, meter]);
          } else {
            meter = new BlePowerMeter(device, server, service, characteristic);
            powerMeters.push([meter.id, meter]);
          }
        }
      }

      // org.bluetooth.service.cycling_speed_and_cadence
      if(!cadenceMeters.find(m => m[0] === device.id)) {
        let service = undefined;
        try {
          service = await server.getPrimaryService(0x1816);
        } catch(error) {}

        if(service) {
          let characteristic = await service.getCharacteristic(0x2A5B);
          meter = new BleCadenceMeter(device, server, service, characteristic);
          cadenceMeters.push([meter.id, meter]);
        }
      }

      // org.bluetooth.service.heart_rate
      if(!heartMeters.find(m => m[0] === device.id)) {
        let service = undefined;
        try {
          service = await server.getPrimaryService(0x180D);
        } catch(error) {}

        if(service) {
          let characteristic = await service.getCharacteristic(0x2A37);
          meter = new BleHRMeter(device, server, service, characteristic);
          heartMeters.push([meter.id, meter]);
        }
      }

      if(meter) {
        redrawMeters(meter);
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
  Ant Button Handler
  */
  $alt.onclick = (e) => {
    e.preventDefault();

    if(!$alt.classList.contains('disabled')) {
      $alt.classList.add('disabled');
    } else {
      return;
    }

    $atntxt.innerHTML = "Scanning ...";
    let $anterr = document.getElementById('btn-ant-device-error');
    $antwsurl.style.display = 'none';
    $anterr.style.display = 'none';
    (async function() {
      let antwsURL = $antwsurl.value;
      localStorage.setItem('ant-ws-url', antwsURL);

      if(!antwsURL) {
        antwsURL = 'http://localhost:8000/';
      }
      const locator = new AntMeterLocator(antwsURL);

      locator.addListener('bike_power', meter => {
        powerMeters.push([meter.id, meter]);
        redrawMeters(meter);
      });

      locator.addListener('speed_cadence', meter => {
        cadenceMeters.push([meter.id, meter]);
        redrawMeters(meter);
      });

      locator.addListener('hr', meter => {
        heartMeters.push([meter.id, meter]);
        redrawMeters(meter);
      });

      locator.addListener('namechange', meter => {
        redrawMeters(meter);
      });

      locator.addListener('error', error => {
        $antwsurl.style.display = 'inline';

        $anterr.innerHTML = '<br/> Could not connect to ANT-WS server located at: ' + locator.url;
        $anterr.style.display = 'inline';

        $alt.classList.remove('disabled');
        $atntxt.innerHTML = "Scan";
      });

      locator.scan();

    })()
    .catch(error => {
      $alt.classList.remove('disabled');
      $atntxt.innerHTML = "Scan";
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

        if($previous.value) {
          let raw = managedLocalStorage.get($previous.value);
          mapDisplay = GPedalDisplay.fromJSON(raw);
          mapDisplay.powerMeter = powerMeter;
          mapDisplay.heartMeter = heartMeter;
          mapDisplay.cadenceMeter = cadenceMeter;

          managedLocalStorage.unshift('route-progress', mapDisplay.cacheName());
        } else {
          let fileBody = await fileRead($gpx.files[0]);
          let factory = new GPXRoutePointFactory(fileBody);
          let points = await factory.create();

          mapDisplay = new GPedalDisplay({points, riderWeight, unit, powerMeter, heartMeter, cadenceMeter});
          managedLocalStorage.add('route-progress', mapDisplay.cacheName(), mapDisplay);
        }

        GPedalDisplay.transitionUI();
        await mapDisplay.init();

        mapDisplay.updateUI();
        await mapDisplay.updatePosition();
        managedLocalStorage.remove('route-progress', mapDisplay.cacheName());
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

  if(localStorage.getItem('ant-ws-url')) {
    $antwsurl.value = localStorage.getItem('ant-ws-url');
  }

  if(!isBle) {
    $blecontainer.style.display = 'none';
    $antcontainer.style.display = 'block';
  }
}
