const Logger = require("./Logger");
const mqtt = require("mqtt");


class MqttClient {
    /**
     * 
     * @param {import("./DummyCloud")} dummyCloud
     */
    constructor(dummyCloud) {
        this.dummyCloud = dummyCloud;

        this.autoconfTimestamps = {};

        this.dummyCloud.onHandshake((data) => {
            this.handleHandshake(data);
        });
        this.dummyCloud.onData((data) => {
            this.handleData(data);
        });
    }

    initialize() {
        const options = {
            clientId: `deye_dummycloud_${Math.random().toString(16).slice(2, 9)}`,  // 23 characters allowed
        };

        if (process.env.MQTT_USERNAME) {
            options.username = process.env.MQTT_USERNAME;

            if (process.env.MQTT_PASSWORD) {
                options.password = process.env.MQTT_PASSWORD;
            }
        } else if (process.env.MQTT_PASSWORD) {
            // MQTT_PASSWORD is set but MQTT_USERNAME is not
            Logger.error("MQTT_PASSWORD is set but MQTT_USERNAME is not. MQTT_USERNAME must be set if MQTT_PASSWORD is set.");
            process.exit(1);
        }

        this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

        this.client.on("connect", () => {
            Logger.info("Connected to MQTT broker");
        });

        this.client.on("error", (e) => {
            if (e && e.message === "Not supported") {
                Logger.info("Connected to non-standard-compliant MQTT Broker.");
            } else {
                Logger.error("MQTT error:", e.toString());
            }
        });

        this.client.on("reconnect", () => {
            Logger.info("Attempting to reconnect to MQTT broker");
        });
    }

    handleHandshake(data) {
        // Nothing to see here
    }

    handleData(data) {
	
		
        this.ensureAutoconf(data.header.loggerSerial.toString(), data.payload.inverter_meta.mppt_count);
        const baseTopic = `${MqttClient.TOPIC_PREFIX}/${data.header.loggerSerial.toString()}`;
        
        if (1 !== data.payload.frameType ) {
           Logger.info("non 1 frame type: " + data.payload.frameType + "not publishing!!");
           return;
        }
            this.client.publish(`${baseTopic}/pv/1/v`, data.payload.pv1_volt.toString());
            this.client.publish(`${baseTopic}/pv/1/i`, data.payload.pv1_current.toString());
            this.client.publish(`${baseTopic}/pv/1/w`, data.payload.pv1_in_power.toString());
            this.client.publish(`${baseTopic}/pv/2/v`, data.payload.pv2_volt.toString());
            this.client.publish(`${baseTopic}/pv/2/i`, data.payload.pv2_current.toString());
            this.client.publish(`${baseTopic}/pv/2/w`, data.payload.pv2_in_power.toString());
            this.client.publish(`${baseTopic}/pv/kWh_total`, data.payload.total_from_pv.toString(),{retain: true});
            this.client.publish(`${baseTopic}/pv/kWh_today`, data.payload.today_from_pv.toString(),{retain: true});
            this.client.publish(`${baseTopic}/grid/active_power_w`, data.payload.grid_total_power_outg.toString());
/*
        for (let i = 1; i <= data.payload.inverter_meta.mppt_count; i++) {
            this.client.publish(`${baseTopic}/pv/${i}/v`, data.payload.pv[`${i}`].v.toString());
            this.client.publish(`${baseTopic}/pv/${i}/i`, data.payload.pv[`${i}`].i.toString());
            this.client.publish(`${baseTopic}/pv/${i}/w`, data.payload.pv[`${i}`].w.toString());
            this.client.publish(
                `${baseTopic}/pv/${i}/kWh_today`,
                data.payload.pv[`${i}`].kWh_today.toString(),
                {retain: true}
            );

            if (data.payload.pv[`${i}`].kWh_total > 0) {
                this.client.publish(
                    `${baseTopic}/pv/${i}/kWh_total`,
                    data.payload.pv[`${i}`].kWh_total.toString(),
                    {retain: true}
                );
            }
        }
*/
//        this.client.publish(`${baseTopic}/grid/active_power_w`, data.payload.grid.active_power_w.toString());
        this.client.publish(
            `${baseTopic}/grid/kWh_today`,
            data.payload.today_bought_from_grid.toString(),
            {retain: true}
        );
/*
        this.client.publish(
            `${baseTopic}/grid/kWh_today`,
            data.payload.grid.kWh_today.toString(),
            {retain: true}
        );
*/
            this.client.publish(
                `${baseTopic}/grid/kWh_total`,
                data.payload.total_bought_from_grid.toString(),
                {retain: true}
            );

/*        
        if (data.payload.grid.kWh_total > 0) {
            this.client.publish(
                `${baseTopic}/grid/kWh_total`,
                data.payload.grid.kWh_total.toString(),
                {retain: true}
            );
        }
*/      

        this.client.publish(`${baseTopic}/grid/va`, data.payload.grid_phasea_volt.toString());
        this.client.publish(`${baseTopic}/grid/vb`, data.payload.grid_phaseb_volt.toString());
        this.client.publish(`${baseTopic}/grid/vc`, data.payload.grid_phasec_volt.toString());
        this.client.publish(`${baseTopic}/grid/hz`, data.payload.grid_freq.toString());
/*
        this.client.publish(`${baseTopic}/inverter/radiator_temperature`, data.payload.inverter.radiator_temp_celsius.toString());
*/        
    }

    ensureAutoconf(loggerSerial, mpptCount) {
        // (Re-)publish every 4 hours
        if (Date.now() - (this.autoconfTimestamps[loggerSerial] ?? 0) <= 4 * 60 * 60 * 1000) {
            return;
        }
        const baseTopic = `${MqttClient.TOPIC_PREFIX}/${loggerSerial.toString()}`;
        const device = {
            "manufacturer":"Deye",
            "model":"Hybrid3Phase",
            "name":`Deye Hybrid Inverter ${loggerSerial}`,
            "identifiers":[
                `deye_dummycloud_${loggerSerial}`
            ]
        };

        for (let i = 1; i <= mpptCount; i++) {
            this.client.publish(
                `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_pv${i}_v/config`,
                JSON.stringify({
                    "state_topic": `${baseTopic}/pv/${i}/v`,
                    "name":`PV ${i} Voltage`,
                    "unit_of_measurement": "V",
                    "device_class": "voltage",
                    "state_class": "measurement",
                    "object_id": `deye_dummycloud_${loggerSerial}_pv_${i}_v`,
                    "unique_id": `deye_dummycloud_${loggerSerial}_pv_${i}_v`,
                    "expire_after": 300,
                    "enabled_by_default": i < 3,
                    "device": device
                }),
                {retain: true}
            );
            this.client.publish(
                `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_pv${i}_i/config`,
                JSON.stringify({
                    "state_topic": `${baseTopic}/pv/${i}/i`,
                    "name":`PV ${i} Current`,
                    "unit_of_measurement": "A",
                    "device_class": "current",
                    "state_class": "measurement",
                    "object_id": `deye_dummycloud_${loggerSerial}_pv_${i}_i`,
                    "unique_id": `deye_dummycloud_${loggerSerial}_pv_${i}_i`,
                    "expire_after": 300,
                    "enabled_by_default": i < 3,
                    "device": device
                }),
                {retain: true}
            );
            this.client.publish(
                `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_pv${i}_w/config`,
                JSON.stringify({
                    "state_topic": `${baseTopic}/pv/${i}/w`,
                    "name":`PV ${i} Power`,
                    "unit_of_measurement": "W",
                    "device_class": "power",
                    "state_class": "measurement",
                    "object_id": `deye_dummycloud_${loggerSerial}_pv_${i}_w`,
                    "unique_id": `deye_dummycloud_${loggerSerial}_pv_${i}_w`,
                    "expire_after": 300,
                    "enabled_by_default": i < 3,
                    "device": device
                }),
                {retain: true}
            );

        }//for mppt count

            this.client.publish(
                `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_pv_kWh_today/config`,
                JSON.stringify({
                    "state_topic": `${baseTopic}/pv/kWh_today`,
                    "name":`PV Energy Today`,
                    "unit_of_measurement": "kWh",
                    "device_class": "energy",
                    "state_class": "total_increasing",
                    "object_id": `deye_dummycloud_${loggerSerial}_pv_kWh_today`,
                    "unique_id": `deye_dummycloud_${loggerSerial}_pv_kWh_today`,
                    "enabled_by_default": true,
                    "device": device
                }),
                {retain: true}
            );
            this.client.publish(
                `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_pv_kWh_total/config`,
                JSON.stringify({
                    "state_topic": `${baseTopic}/pv/kWh_total`,
                    "name":`PV Energy Total`,
                    "unit_of_measurement": "kWh",
                    "device_class": "energy",
                    "state_class": "total_increasing",
                    "object_id": `deye_dummycloud_${loggerSerial}_pv_kWh_total`,
                    "unique_id": `deye_dummycloud_${loggerSerial}_pv_kWh_total`,
                    "enabled_by_default": true,
                    "device": device
                }),
                {retain: true}
            );


        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_active_power_w/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/active_power_w`,
                "name":"Grid Power (Active)",
                "unit_of_measurement": "W",
                "device_class": "power",
                "state_class": "measurement",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_active_power_w`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_active_power_w`,
                "expire_after": 300,
                "device": device
            }),
            {retain: true}
        );
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_kWh_today/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/kWh_today`,
                "name":"Grid Energy Today",
                "unit_of_measurement": "kWh",
                "device_class": "energy",
                "state_class": "total_increasing",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_energy_today`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_energy_today`,
                "device": device
            }),
            {retain: true}
        );
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_kWh_total/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/kWh_total`,
                "name":"Grid Energy Total",
                "unit_of_measurement": "kWh",
                "device_class": "energy",
                "state_class": "total_increasing",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_energy_total`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_energy_total`,
                "device": device
            }),
            {retain: true}
        );
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_va/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/va`,
                "name":"Phase A Grid Voltage",
                "unit_of_measurement": "V",
                "device_class": "voltage",
                "state_class": "measurement",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_va`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_va`,
                "expire_after": 300,
                "device": device
            }),
            {retain: true}
        );
        
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_vb/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/vb`,
                "name":"Phase B Grid Voltage",
                "unit_of_measurement": "V",
                "device_class": "voltage",
                "state_class": "measurement",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_vb`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_vb`,
                "expire_after": 300,
                "device": device
            }),
            {retain: true}
        );
        
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_vc/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/vc`,
                "name":"Phase C Grid Voltage",
                "unit_of_measurement": "V",
                "device_class": "voltage",
                "state_class": "measurement",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_vc`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_vc`,
                "expire_after": 300,
                "device": device
            }),
            {retain: true}
        );
        
        
        
        this.client.publish(
            `homeassistant/sensor/deye_dummycloud_${loggerSerial}/${loggerSerial}_grid_hz/config`,
            JSON.stringify({
                "state_topic": `${baseTopic}/grid/hz`,
                "name":"Grid Frequency",
                "unit_of_measurement": "Hz",
                "device_class": "frequency",
                "state_class": "measurement",
                "object_id": `deye_dummycloud_${loggerSerial}_grid_hz`,
                "unique_id": `deye_dummycloud_${loggerSerial}_grid_hz`,
                "expire_after": 300,
                "device": device
            }),
            {retain: true}
        );


        this.autoconfTimestamps[loggerSerial] = Date.now();
    }
}

MqttClient.TOPIC_PREFIX = "deye-dummycloud";

module.exports = MqttClient;
