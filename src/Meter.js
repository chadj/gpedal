import {timeout} from './lib/utils';
import faye from 'faye';

let ble_sint16 = ['getInt16', 2, true];
let ble_uint8 = ['getUint8', 1];
let ble_uint16 = ['getUint16', 2, true];
let ble_uint32 = ['getUint32', 4, true];
// TODO: paired 12bit uint handling
let ble_uint24 = ['getUint8', 3];

// https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.characteristic.cycling_power_measurement.xml
let cycling_power_measurement = [
  [0, [ [ble_sint16, 'instantaneous_power'] ]],
  [1, [ [ble_uint8, 'pedal_power_balance'] ]],
  [2, [ /* Pedal Power Balance Reference */]],
  [4, [ [ble_uint16, 'accumulated_torque'] ]],
  [8, [ /* Accumulated Torque Source */]],
  [16, [ [ble_uint32, 'cumulative_wheel_revolutions'], [ble_uint16, 'last_wheel_event_time'] ]],
  [32, [ [ble_uint16, 'cumulative_crank_revolutions'], [ble_uint16, 'last_crank_event_time'] ]],
  [64, [ [ble_sint16, 'maximum_force_magnitude'], [ble_sint16, 'minimum_force_magnitude'] ]],
  [128, [ [ble_sint16, 'maximum_torque_magnitude'], [ble_sint16, 'minimum_torque_magnitude'] ]],
  [256, [ [ble_uint24, 'maximum_minimum_angle'] ]],
  [512, [ [ble_uint16, 'top_dead_spot_angle'] ]],
  [1024, [ [ble_uint16, 'bottom_dead_spot_angle'] ]],
  [2048, [ [ble_uint16, 'accumulated_energy'] ]],
  [4096, [ /* Offset Compensation Indicator */]]
];

// https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.characteristic.csc_measurement.xml
let csc_measurement = [
  [1, [ [ble_uint32, 'cumulative_wheel_revolutions'], [ble_uint16, 'last_wheel_event_time'] ]],
  [2, [ [ble_uint16, 'cumulative_crank_revolutions'], [ble_uint16, 'last_crank_event_time'] ]]
];

let ant_manufacturers = {
  1: 'garmin',
  2: 'garmin_fr405_antfs',
  3: 'zephyr',
  4: 'dayton',
  5: 'idt',
  6: 'srm',
  7: 'quarq',
  8: 'ibike',
  9: 'saris',
  10: 'spark_hk',
  11: 'tanita',
  12: 'echowell',
  13: 'dynastream_oem',
  14: 'nautilus',
  15: 'dynastream',
  16: 'timex',
  17: 'metrigear',
  18: 'xelic',
  19: 'beurer',
  20: 'cardiosport',
  21: 'a_and_d',
  22: 'hmm',
  23: 'suunto',
  24: 'thita_elektronik',
  25: 'gpulse',
  26: 'clean_mobile',
  27: 'pedal_brain',
  28: 'peaksware',
  29: 'saxonar',
  30: 'lemond_fitness',
  31: 'dexcom',
  32: 'wahoo_fitness',
  33: 'octane_fitness',
  34: 'archinoetics',
  35: 'the_hurt_box',
  36: 'citizen_systems',
  37: 'magellan',
  38: 'osynce',
  39: 'holux',
  40: 'concept2',
  42: 'one_giant_leap',
  43: 'ace_sensor',
  44: 'brim_brothers',
  45: 'xplova',
  46: 'perception_digital',
  47: 'bf1systems',
  48: 'pioneer',
  49: 'spantec',
  50: 'metalogics',
  51: '4iiiis',
  52: 'seiko_epson',
  53: 'seiko_epson_oem',
  54: 'ifor_powell',
  55: 'maxwell_guider',
  56: 'star_trac',
  57: 'breakaway',
  58: 'alatech_technology_ltd',
  59: 'mio_technology_europe',
  60: 'rotor',
  61: 'geonaute',
  62: 'id_bike',
  63: 'specialized',
  64: 'wtek',
  65: 'physical_enterprises',
  66: 'north_pole_engineering',
  67: 'bkool',
  68: 'cateye',
  69: 'stages_cycling',
  70: 'sigmasport',
  71: 'tomtom',
  72: 'peripedal',
  73: 'wattbike',
  76: 'moxy',
  77: 'ciclosport',
  78: 'powerbahn',
  79: 'acorn_projects_aps',
  80: 'lifebeam',
  81: 'bontrager',
  82: 'wellgo',
  83: 'scosche',
  84: 'magura',
  85: 'woodway',
  86: 'elite',
  87: 'nielsen_kellerman',
  88: 'dk_city',
  89: 'tacx',
  90: 'direction_technology',
  91: 'magtonic',
  92: '1partcarbon',
  93: 'inside_ride_technologies',
  94: 'sound_of_motion',
  95: 'stryd',
  96: 'icg',
  97: 'MiPulse',
  98: 'bsx_athletics',
  99: 'look',
  100: 'campagnolo_srl',
  101: 'body_bike_smart',
  102: 'praxisworks',
  103: 'limits_technology',
  104: 'topaction_technology',
  105: 'cosinuss',
  106: 'fitcare',
  107: 'magene',
  108: 'giant_manufacturing_co',
  109: 'tigrasport',
  110: 'salutron',
  111: 'technogym',
  112: 'bryton_sensors',
  113: 'latitude_limited',
  114: 'soaring_technology',
  115: 'igpsport',
  116: 'thinkrider',
  117: 'gopher_sport',
  118: 'waterrower',
  255: 'development',
  257: 'healthandlife',
  258: 'lezyne',
  259: 'scribe_labs',
  260: 'zwift',
  261: 'watteam',
  262: 'recon',
  263: 'favero_electronics',
  264: 'dynovelo',
  265: 'strava',
  266: 'precor',
  267: 'bryton',
  268: 'sram',
  269: 'navman',
  270: 'cobi',
  271: 'spivi',
  272: 'mio_magellan',
  273: 'evesports',
  274: 'sensitivus_gauge',
  275: 'podoon',
  276: 'life_time_fitness',
  277: 'falco_e_motors',
  278: 'minoura',
  279: 'cycliq',
  280: 'luxottica',
  281: 'trainer_road',
  282: 'the_sufferfest',
  283: 'fullspeedahead',
  284: 'virtualtraining',
  285: 'feedbacksports',
  286: 'omata',
  287: 'vdo',
  5759: 'actigraphcorp'
};

class BleCharacteristicParser {
  getData(dataview) {
    let offset = 0;
    let mask;
    if(this.mask_size === 16) {
      mask = dataview.getUint16(0, true);
      offset += 2;
    } else {
      mask = dataview.getUint8(0);
      offset += 1;
    }

    let fieldArrangement = [];

    // Contains required fields
    if(this.fields[0][0] === 0) {
      for(let fdesc of this.fields[0][1]) {
        fieldArrangement.push(fdesc);
      }
    }

    for(let [flag, fieldDescriptions] of this.fields) {
      if(mask & flag) {
        for(let fdesc of fieldDescriptions) {
          fieldArrangement.push(fdesc);
        }
      }
    }

    let data = {};
    for(let field of fieldArrangement) {
      var [[accessor, fieldSize, endianness], fieldName] = field;
      let value;
      if(endianness) {
        value = dataview[accessor](offset, endianness);
      } else {
        value = dataview[accessor](offset);
      }

      data[fieldName] = value;
      offset += fieldSize;
    }

    return data;
  }
}

class CyclingSpeedCadenceMeasurementParser extends BleCharacteristicParser {
  constructor () {
    super();
    this.fields = csc_measurement;
    this.mask_size = 8;
  }
}

export class CyclingPowerMeasurementParser extends BleCharacteristicParser {
  constructor () {
    super();
    this.fields = cycling_power_measurement;
    this.mask_size = 16;
  }
}

export class Meter {
  constructor () {
    this.listeners = {};
    this.timeoutID = undefined;
    this.milliTimeout = 8000;
  }

  clearValueOnTimeout(value) {
    if(this.timeoutID !== undefined) {
      clearTimeout(this.timeoutID);
    }
    this.timeoutID = setTimeout(() => {
      this.timeoutID = undefined;
      if(value.constructor === Array) {
        for(let v of value) {
          this.dispatch(v, 0);
        }
      } else {
        this.dispatch(value, 0);
      }
    }, this.milliTimeout);
  }

  addListener(type, callback) {
    if(!(type in this.listeners)) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(callback);
  }

  dispatch(type, value) {
    if(!(type in this.listeners)) {
      this.listeners[type] = [];
    }

    for(let l of this.listeners[type]) {
      l(value);
    }
  }
}

export class BleMeter extends Meter {
  constructor (device, server, service, characteristic) {
    super();

    this.device = device;
    this.server = server;
    this.service = service;
    this.characteristic = characteristic;

    this.name = this.device.name;
    this.id = this.device.id;

    this.listening = false;

    this.device.addEventListener('gattserverdisconnected', e => {
      this.gattserverdisconnected(e)
        .catch(error => {
          console.log("Error: ", error);
        });
    });
  }

  async gattserverdisconnected(e) {
    console.log('Reconnecting');
    this.server = await this.device.gatt.connect();
    this.service = await this.server.getPrimaryService(this.serviceId);
    this.characteristic = await this.service.getCharacteristic(this.characteristicId);
    if(this.listening) {
      this.listening = false;
      this.listen();
    }
  }
}

export class BlePowerCadenceMeter extends BleMeter {
  constructor (device, server, service, characteristic) {
    super(device, server, service, characteristic);

    this.serviceId = 0x1818;
    this.characteristicId = 0x2A63;
    this.parser = new CyclingPowerMeasurementParser();

    this.lastCrankRevolutions = 0;
    this.lastCrankTime = 0;
    this.lastWheelRevolutions = 0;
    this.lastWheelTime = 0;
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let data = this.parser.getData(event.target.value);
        let power = data['instantaneous_power'];
        let crankRevolutions = data['cumulative_crank_revolutions'];
        let crankTime = data['last_crank_event_time'];
        let wheelRevolutions = data['cumulative_wheel_revolutions'];
        let wheelTime = data['last_wheel_event_time'];

        /* Crank Calc */
        if(this.lastCrankTime > crankTime) {
          this.lastCrankTime = this.lastCrankTime - 65536;
        }
        if(this.lastCrankRevolutions > crankRevolutions) {
          this.lastCrankRevolutions = this.lastCrankRevolutions - 65536;
        }

        let revs = crankRevolutions - this.lastCrankRevolutions;
        let duration = (crankTime - this.lastCrankTime) / 1024;
        let rpm = 0;
        if(duration > 0) {
          rpm = (revs / duration) * 60;
        }

        this.lastCrankRevolutions = crankRevolutions;
        this.lastCrankTime = crankTime;
        /* End Crank Calc */

        /* Wheel Calc */
        if(wheelRevolutions !== undefined && wheelTime !== undefined) {
            if(this.lastWheelTime > wheelTime) {
                this.lastWheelTime = this.lastWheelTime - 65536;
            }
            if(this.lastWheelRevolutions > wheelRevolutions) {
                this.lastWheelRevolutions = this.lastWheelRevolutions - 65536;
            }

            let wheelRevs = wheelRevolutions - this.lastWheelRevolutions;
            let wheelDuration = (wheelTime - this.lastWheelTime) / 1024;
            let wheelRpm = 0;
            if(wheelDuration > 0) {
                wheelRpm = (wheelRevs / wheelDuration) * 60;
            }

            this.lastWheelRevolutions = wheelRevolutions;
            this.lastWheelTime = wheelTime;

            this.dispatch('wheelrpm', wheelRpm);
        }
        /* End Wheel Calc */

        this.dispatch('power', power);
        this.dispatch('cadence', rpm);
        this.clearValueOnTimeout(['power', 'cadence', 'wheelrpm']);
      });
      this.characteristic.startNotifications();
      this.listening = true;
    }
  }

}

export class BlePowerMeter extends BleMeter {
  constructor (device, server, service, characteristic) {
    super(device, server, service, characteristic);

    this.serviceId = 0x1818;
    this.characteristicId = 0x2A63;
    this.parser = new CyclingPowerMeasurementParser();
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let data = this.parser.getData(event.target.value);
        let power = data['instantaneous_power'];
        this.dispatch('power', power);
        this.clearValueOnTimeout('power');
      });
      this.characteristic.startNotifications();
      this.listening = true;
    }
  }

}

export class BleCadenceMeter extends BleMeter  {
  constructor (device, server, service, characteristic) {
    super(device, server, service, characteristic);

    this.serviceId = 0x1816;
    this.characteristicId = 0x2A5B;
    this.parser = new CyclingSpeedCadenceMeasurementParser();

    this.lastCrankRevolutions = 0;
    this.lastCrankTime = 0;
    this.lastWheelRevolutions = 0;
    this.lastWheelTime = 0;
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let data = this.parser.getData(event.target.value);
        let crankRevolutions = data['cumulative_crank_revolutions'];
        let crankTime = data['last_crank_event_time'];
        let wheelRevolutions = data['cumulative_wheel_revolutions'];
        let wheelTime = data['last_wheel_event_time'];

        if(crankRevolutions !== undefined && crankTime !== undefined) {
            if(this.lastCrankTime > crankTime) {
                this.lastCrankTime = this.lastCrankTime - 65536;
            }
            if(this.lastCrankRevolutions > crankRevolutions) {
                this.lastCrankRevolutions = this.lastCrankRevolutions - 65536;
            }

            let revs = crankRevolutions - this.lastCrankRevolutions;
            let duration = (crankTime - this.lastCrankTime) / 1024;
            let rpm = 0;
            if(duration > 0) {
                rpm = (revs / duration) * 60;
            }

            this.lastCrankRevolutions = crankRevolutions;
            this.lastCrankTime = crankTime;

            this.dispatch('cadence', rpm);
        }

        if(wheelRevolutions !== undefined && wheelTime !== undefined) {
            if(this.lastWheelTime > wheelTime) {
                this.lastWheelTime = this.lastWheelTime - 65536;
            }
            if(this.lastWheelRevolutions > wheelRevolutions) {
                this.lastWheelRevolutions = this.lastWheelRevolutions - 65536;
            }
    
            let wheelRevs = wheelRevolutions - this.lastWheelRevolutions;
            let wheelDuration = (wheelTime - this.lastWheelTime) / 1024;
            let wheelRpm = 0;
            if(wheelDuration > 0) {
                wheelRpm = (wheelRevs / wheelDuration) * 60;
            }
    
            this.lastWheelRevolutions = wheelRevolutions;
            this.lastWheelTime = wheelTime;

            this.dispatch('wheelrpm', wheelRpm);
        }

        this.clearValueOnTimeout(['cadence', 'wheelrpm']);
      });
      this.characteristic.startNotifications();
      this.listening = true;
    }
  }

}

export class BleHRMeter extends BleMeter {
  constructor (device, server, service, characteristic) {
    super(device, server, service, characteristic);

    this.serviceId = 0x180D;
    this.characteristicId = 0x2A37;
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let hr = event.target.value.getUint8(1);
        this.dispatch('hr', hr);
        this.clearValueOnTimeout('hr');
      });
      this.characteristic.startNotifications();
      this.listening = true;
    }
  }

}

export class VirtualPowerMeter extends Meter {
  constructor () {
    super();
    this.listening = false;
    this.watts = 0;

    this.id = 'virtual';
    this.name = 'Virtual Power Meter';
  }

  listen() {
    if(!this.listening) {
      document.getElementById('ui-vpower-container').style.display = 'block';
      let $vpower = document.getElementById('vpower');
      $vpower.value = this.watts;
      $vpower.onchange = e => {
        this.watts = parseInt($vpower.value);
      };

      setInterval(() => {
        this.dispatch('power', this.watts);
      }, 750);

      this.listening = true;
    }
  }

}

export class CycleopsMagnetoPowerCurve extends Meter {
    constructor () {
        super();
        this.listening = false;
  
        this.id = 'cycleopsmagnetopowercurve';
        this.name = 'Cycleops Magneto Power Curve';
    }
  
    listen(opts) {
      if(!this.listening) {
        let cadenceMeter = opts.cadenceMeter;
        if(cadenceMeter !== undefined) {
            cadenceMeter.addListener('wheelrpm', (wheelrpm) => {
                // Hardcoded to 28mm tires
                let wheelCircumference = 2136;
                let kph = (wheelCircumference * wheelrpm * 60) / 1000000;
                let watts = this.Exponential_DoubleAsymptoticExponentialB_model(kph);
                if(watts < 0) {
                    watts = 0;
                }
                this.dispatch('power', watts);
                this.clearValueOnTimeout('power');
            });

            this.listening = true;
        }
      }
    }
  
    // Derived from data found here:
    //    https://machiine.com/2018/how-accurate-is-zwifts-power-estimate-for-classic-trainers/
    // Curve fitting utilizing:
    //    http://zunzun.com/
    Exponential_DoubleAsymptoticExponentialB_model(x_in) {
        let temp;
        temp = 0.0;

        // coefficients
        let a = -4.2557472799016870E+02;
        let b = 1.6719781580876170E-02;
        let c = -7.3525587442334214E+01;
        let d = -1.3986922573862917E-01;

        temp = a * (1.0 - Math.exp(b * x_in)) + c * (1.0 - Math.exp(d * x_in));
        return temp;
    }
  
  }

export class AntMeter extends Meter {
  constructor (type, manId, modelNum, deviceId) {
    super();

    this.type = type;
    this.manId = manId;
    this.modelNum = modelNum;
    this.deviceId = deviceId;

    this.setName();
  }

  listen() {}

  setName() {
    let nameManufacturer = 'Unknown';
    if(this.manId in ant_manufacturers) {
      nameManufacturer = ant_manufacturers[this.manId]
        .split('_')
        .map(word => {
            return word[0].toUpperCase() + word.substr(1);
        })
        .join(' ');
    }

    this.name = nameManufacturer + ' - ' + this.deviceId;
  }
}

export class AntPowerMeter extends AntMeter {
  constructor (id, type, manId, modelNum, deviceId) {
    super(type, manId, modelNum, deviceId);

    this.id = id;
  }

  antMessage(message) {
    let power = message.Power;
    if(power !== undefined) {
      this.dispatch('power', power);
      this.clearValueOnTimeout('power');
    }
  }
}

export class AntCadenceMeter extends AntMeter  {
  constructor (id, type, manId, modelNum, deviceId) {
    super(type, manId, modelNum, deviceId);

    this.id = id;

    this.lastWheelRevolutions = 0;
    this.lastWheelTime = 0;
  }

  antMessage(message) {
    let cadence = undefined;
    if(message.Cadence !== undefined) {
      cadence = message.Cadence;
    }
    if(message.CalculatedCadence !== undefined) {
      cadence = message.CalculatedCadence;
    }
    if(cadence !== undefined) {
      this.dispatch('cadence', cadence);
    }

    let wheelTime = message.SpeedEventTime;
    let wheelRevolutions = message.CumulativeSpeedRevolutionCount;
    if(wheelRevolutions !== undefined && wheelTime !== undefined && this.lastWheelTime !== wheelTime) {
        if(this.lastWheelTime > wheelTime) {
            this.lastWheelTime = this.lastWheelTime - 65536;
        }
        if(this.lastWheelRevolutions > wheelRevolutions) {
            this.lastWheelRevolutions = this.lastWheelRevolutions - 65536;
        }

        let wheelRevs = wheelRevolutions - this.lastWheelRevolutions;
        let wheelDuration = (wheelTime - this.lastWheelTime) / 1024;
        let wheelRpm = 0;
        if(wheelDuration > 0) {
            wheelRpm = (wheelRevs / wheelDuration) * 60;
        }

        this.lastWheelRevolutions = wheelRevolutions;
        this.lastWheelTime = wheelTime;

        this.dispatch('wheelrpm', wheelRpm);
    }

    this.clearValueOnTimeout(['cadence', 'wheelrpm']);
  }
}

export class AntHRMeter extends AntMeter {
  constructor (id, type, manId, modelNum, deviceId) {
    super(type, manId, modelNum, deviceId);

    this.id = id;
  }

  antMessage(message) {
    let hr = message.ComputedHeartRate;
    if(hr !== undefined) {
      this.dispatch('hr', hr);
      this.clearValueOnTimeout('hr');
    }
  }
}

export class AntMeterLocator {
  constructor (url='http://localhost:8000/') {
    this.url = url;
    this.listeners = {};
    this.devicesByType = {};
    this.devices = {};

    if(!this.url.startsWith('http')) {
      this.url = 'http://' + this.url;
    }

    if(!this.url.endsWith('/')) {
      this.url = this.url + '/';
    }

    this.meterClasses = {
      'hr': AntHRMeter,
      'bike_power': AntPowerMeter,
      'speed_cadence': AntCadenceMeter,
    }
  }

  addListener(type, callback) {
    if(!(type in this.listeners)) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(callback);
  }

  dispatch(type, value) {
    if(!(type in this.listeners)) {
      this.listeners[type] = [];
    }

    for(let l of this.listeners[type]) {
      l(value);
    }
  }

  scan() {
    let client = new faye.Client(this.url, {timeout: 120, retry: 10});
    client.on('transport:down', (error) => {
      this.dispatch('error', error);
    });

    client.subscribe('/*', message => {
      const msg = JSON.parse(message.text);
      let msgTypes = [msg.type];
      if(msg.type === 'bike_power' && (msg.Cadence || msg.CalculatedCadence)) {
        msgTypes.push('speed_cadence');
      }

      for(let type of msgTypes) {
        let meterId = type + msg.DeviceID;
        if(!(meterId in this.devicesByType) && type in this.meterClasses) {
          let meter = new this.meterClasses[type](meterId, type, msg.ManId, msg.ModelNum, msg.DeviceID);
          if(!(msg.DeviceID in this.devices)) {
            this.devices[msg.DeviceID] = [];
          }
          this.devices[msg.DeviceID].push(meter);
          this.devicesByType[meterId] = meter;
          this.dispatch(type, meter);
        }
      }

      if(msg.DeviceID in this.devices) {
        for(let meter of this.devices[msg.DeviceID]) {
          meter.antMessage(msg);
        }
      }

      if(msg.ManId !== undefined || msg.ModelNum !== undefined) {
        if(msg.DeviceID in this.devices) {
          for(let meter of this.devices[msg.DeviceID]) {
            let nameChange = false;
            if(msg.ManId !== undefined && msg.ManId !== meter.manId) {
              meter.manId = msg.ManId;
              nameChange = true;
            }
            if(msg.ModelNum !== undefined && msg.ModelNum !== meter.modelNum) {
              meter.modelNum = msg.ModelNum;
              nameChange = true;
            }

            if(nameChange) {
              meter.setName();
              this.dispatch('namechange', meter);
            }
          }
        }
      }
    });
  }
}

//
//  Meter for BH Fitness BladeZ Indoor Cycling bikes that support a Class Bluetooth wireless connection.  These
//  bikes use the Serial Port Profile of the classic bluetooth spec. that be read and written to via the Web
//  Serial API ( https://codelabs.developers.google.com/codelabs/web-serial/ ) and
//  ( https://wicg.github.io/serial/ ).  This code has only been tested with a BladeZ r500i.
//
export class BHBladeZBikeMeter extends Meter {
    constructor (port) {
        super();
    
        this.port = port;
        this.name = 'BH BladeZ Bike Meter';
        this.id = 'BHBladeZBikeMeter';
        this.listening = false;

        this.inputStream = this.port.readable;
        this.reader = this.inputStream.getReader();

        this.outputStream = this.port.writable;

        this.initCommandsRaw = [ [ 85, 12, 1, -1 ], [ 85, -69, 1, -1 ], [ 85, 36, 1, -1 ], [ 85, 37, 1, -1 ], [ 85, 38, 1, -1 ], [ 85, 39, 1, -1 ], [ 85, 2, 1, -1 ], [ 85, 3, 1, -1 ], [ 85, 4, 1, -1 ], [ 85, 6, 1, -1 ], [ 85, 31, 1, -1 ], [ 85, -96, 1, -1 ], [ 85, -80, 1, -1 ], [ 85, -78, 1, -1 ], [ 85, -77, 1, -1 ], [ 85, -76, 1, -1 ], [ 85, -75, 1, -1 ], [ 85, -74, 1, -1 ], [ 85, -73, 1, -1 ], [ 85, -72, 1, -1 ], [ 85, -71, 1, -1 ], [ 85, -70, 1, -1 ], [ 85, 11, 1, -1 ], [ 85, 24, 1, -1 ], [ 85, 25, 1, -1 ], [ 85, 26, 1, -1 ], [ 85, 27, 1, -1 ] ];
        this.initCommands = [];

        this.keepAliveCommandRaw = [ 85, 23, 1, 1 ];
        this.keepAliveCommand = new Int8Array(this.keepAliveCommandRaw.length);

        this.startCommandRaw = [ 85, 10, 1, 1 ];
        this.startCommand = new Int8Array(this.startCommandRaw.length);

        this.setinclineCommandRaw = [ 85, 17, 1, 15 ];
        this.setinclineCommand = new Int8Array(this.setinclineCommandRaw.length);

        this.resetCommandRaw = [ 85, 10, 1, 2 ];
        this.resetCommand = new Int8Array(this.resetCommandRaw.length);

        this.setUserDataCommandRaw = [ 85, 1, 6, 35, 0, 250, 0, 74, 0];
        this.setUserDataCommand = new Int8Array(this.setUserDataCommandRaw.length);

        this.setActionModeCommandRaw = [ 85, 21, 1, 0 ];
        this.setActionModeCommand = new Int8Array(this.setActionModeCommandRaw.length);

        this.queryPulseTypeCommandRaw = [ 85, 7, 1, -1 ];
        this.queryPulseTypeCommand = new Int8Array(this.queryPulseTypeCommandRaw.length);
    }

    listen() {
        if(!this.listening) {
            this.listening = true;
            this.initializeDevice().catch(console.error);
        }
    }

    async initializeDevice() {
        this.initializeCommands();

        this.readLoop().catch(console.error);

        for(let c of this.initCommands) {
            await this.writeToStream(c);
        }
    
        await timeout(1000);
    
        await this.writeToStream(this.keepAliveCommand);
    
        await timeout(5000);
    
        await this.writeToStream(this.resetCommand);
    
        await timeout(500);
    
        await this.writeToStream(this.setUserDataCommand);
    
        await timeout(500);
    
        await this.writeToStream(this.setActionModeCommand);
    
        await timeout(500);
    
        await this.writeToStream(this.setinclineCommand);
    
        await timeout(500);
    
        await this.writeToStream(this.startCommand);
    
        await timeout(500);
    
        await this.writeToStream(this.queryPulseTypeCommand);
    
        await timeout(1000);
    
        this.maintainKeepAlive().catch(console.error);
    }

    initializeCommands() {
        for(let commandRaw of this.initCommandsRaw) {
            let command = new Int8Array(commandRaw.length);
            commandRaw.forEach((b,i) => {
                command[i] = b;
            });
            this.initCommands.push(command);
        }
        this.initCommandsRaw = null;
        
        this.keepAliveCommandRaw.forEach((b,i) => {
            this.keepAliveCommand[i] = b;
        });
        this.keepAliveCommandRaw = null;

        this.startCommandRaw.forEach((b,i) => {
            this.startCommand[i] = b;
        });
        this.startCommandRaw = null;

        this.setinclineCommandRaw.forEach((b,i) => {
            this.setinclineCommand[i] = b;
        });
        this.setinclineCommandRaw = null;

        this.resetCommandRaw.forEach((b,i) => {
            this.resetCommand[i] = b;
        });
        this.resetCommandRaw = null;

        this.setUserDataCommandRaw.forEach((b,i) => {
            this.setUserDataCommand[i] = b;
        });
        this.setUserDataCommandRaw = null;

        this.setActionModeCommandRaw.forEach((b,i) => {
            this.setActionModeCommand[i] = b;
        });
        this.setActionModeCommandRaw = null;

        this.queryPulseTypeCommandRaw.forEach((b,i) => {
            this.queryPulseTypeCommand[i] = b;
        });
        this.queryPulseTypeCommandRaw = null;
    }

    async writeToStream(...chunks) {
        const writer = this.outputStream.getWriter();
        for(let chunk of chunks) {
          await writer.write(chunk);
        }
        writer.releaseLock();
    }
    
    async maintainKeepAlive() {
        while (true) {
            await timeout(5000);
            await this.writeToStream(this.keepAliveCommand);
        }
    }

    async readLoop() {
        while (true) {
            const { value, done } = await this.reader.read();
            if (value) {
                let length = value.length;
                let str = "";
                for(let v of value) {
                    v = v.toString(16);
                    if(v.length === 1) {
                        v = "0"+v;
                    }
                    str = str + v;
                }
    
                let position = str.indexOf('550d');
                if(position !== -1) {
                    let offset = position/2;
                    if(length >= offset + 16) {
                        offset += 3;
                        let ab = value.buffer.slice(offset);
                        const vals8 = new Int8Array(ab);
                        const level = vals8[8];
                        const rpm = vals8[10] & 0xFF;
                        const cal = (new DataView(ab.slice(4,6))).getInt16(0, false);
                        const time = (new DataView(ab.slice(0,2))).getInt16(0, false);
                        const watts = (new DataView(ab.slice(11,13))).getInt16(0, false);
    
                        this.dispatch('power', watts);
                        this.dispatch('cadence', rpm);
                        this.clearValueOnTimeout(['power', 'cadence']);
                    }
                }
            }
            if (done) {
                this.reader.releaseLock();
                break;
            }
        }
    }
}