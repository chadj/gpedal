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

export class BleMeter {
  constructor (device, server, service, characteristic) {
    this.device = device;
    this.server = server;
    this.service = service;
    this.characteristic = characteristic;

    this.name = this.device.name;
    this.id = this.device.id;

    this.listening = false;
    this.listeners = {};

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

export class BlePowerCadenceMeter extends BleMeter {
  constructor (device, server, service, characteristic) {
    super(device, server, service, characteristic);

    this.serviceId = 0x1818;
    this.characteristicId = 0x2A63;
    this.parser = new CyclingPowerMeasurementParser();

    this.lastCrankRevolutions = 0;
    this.lastCrankTime = 0;
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let data = this.parser.getData(event.target.value);
        let power = data['instantaneous_power'];
        let crankRevolutions = data['cumulative_crank_revolutions'];
        let crankTime = data['last_crank_event_time'];

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

        this.dispatch('power', power);
        this.dispatch('cadence', rpm);
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
  }

  listen() {
    if(!this.listening) {
      this.characteristic.addEventListener('characteristicvaluechanged', event => {
        let data = this.parser.getData(event.target.value);
        let crankRevolutions = data['cumulative_crank_revolutions'];
        let crankTime = data['last_crank_event_time'];

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
      });
      this.characteristic.startNotifications();
      this.listening = true;
    }
  }

}

export class VirtualPowerMeter {
  constructor () {
    this.listeners = {};
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
