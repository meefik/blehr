/**
 * Created by anton on 18.07.14.
 */


var noble = require('noble');
var fs = require('fs');

var hrvDevices = [];

var heartRateServiceUuid = "180d";
var heartRateMeasurementCharacteristicUuid = "2a37";
var batteryLevelServiceUuid = "180f";
var batteryLevelCharacteristicUuid = "2a19";

var limitHR = 10;

//var peripheralUuid = process.argv[2];

noble.on('stateChange', function (state) {
    if (state === 'poweredOn') {
        //noble.startScanning([], true);
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

setInterval(function() { if (hrvDevices.length > 0) console.log(hrvDevices); }, 10000);

discover();

function dumpHR(uuid,hr) {
    // write kig to file
    var time = new Date().getTime();
    fs.appendFile(uuid+'.csv', time+';'+hr+'\n', encoding='utf8', function (err) {
        if (err) throw err;
    });
}

function discover() {

    noble.on('discover', function (peripheral) {

        if (peripheral.advertisement.serviceUuids.indexOf(heartRateServiceUuid) > -1) {

            var dev = {"uuid": peripheral.uuid, "name": peripheral.advertisement.localName, "battery": -1, "hr": []};

            hrvDevices.push(dev);

            peripheral.on('disconnect', function () {
                hrvDevices.splice(hrvDevices.indexOf(dev), 1);
                console.log('disconnect: ' + dev.uuid + ' (' + dev.name + ')');
            });

            peripheral.connect(function (error) {

                console.log('connected to peripheral: ' + dev.uuid + ' (' + dev.name + ')');
                //console.log(peripheral);

                peripheral.discoverServices([heartRateServiceUuid, batteryLevelServiceUuid], function (error, services) {
                    var heartRateService = services[0];
                    var batteryLevelService = services[1];

                    heartRateService.discoverCharacteristics([heartRateMeasurementCharacteristicUuid], function (error, characteristics) {
                        var heartRateMeasurementCharacteristic = characteristics[0];

                        console.log('characteristic found: ' + heartRateMeasurementCharacteristic.uuid + ' (' + heartRateMeasurementCharacteristic.name + ')');

                        heartRateMeasurementCharacteristic.on('read', function (data, isNotification) {
                            var flag = data[0];
                            //Check if u8 or u16 and get heart rate
                            var hr;
                            if ((flag & 0x01) == 1) {
                                var u16bytes = data.slice(1, 3);
                                var u16 = new Uint16Array(u16bytes)[0];
                                hr = u16;
                            } else {
                                var u8bytes = data.slice(1, 2);
                                var u8 = new Uint8Array(u8bytes)[0];
                                hr = u8;
                            }
                            var interval = Math.round(60 * 1000 / hr);
                            dev.hr.push(hr);
                            if (dev.hr.length > limitHR) dev.hr.shift();
                            //console.log('heart rate: ' + hr + '\t interval: ' + interval);
                            //console.log(hrvDevices);

                            dumpHR(dev.uuid,hr);

                        });

                        // true to enable notify
                        heartRateMeasurementCharacteristic.notify(true, function (error) {
                            console.log('heart rate notification on');
                        });

                    });

                    batteryLevelService.discoverCharacteristics([batteryLevelCharacteristicUuid], function (error, characteristics) {
                        var batteryLevelCharacteristic = characteristics[0];
                        batteryLevelCharacteristic.on('read', function (data, isNotification) {
                            dev.battery = data[0];
                            console.log('battery level: ' + data[0] + '%');
                        });
                        // true to enable notify
                        batteryLevelCharacteristic.notify(true, function (error) {
                            console.log('battery level notification on');
                        });
                        batteryLevelCharacteristic.read();
                    });

                });
            });
        }

    });

}