const Logger = require("./Logger");
const {getKeyByValue, truncateToNullTerminator} = require("./util");

const HEADER_LEN = 11;
//const HEADER_LEN = 28;
const FOOTER_LEN = 2;

class Protocol {
    static parseHeader(buf) {
        const result = {
            magic: buf[0], //should be 0xa5
            payloadLength: buf.readUInt16LE(1),
            unknown1: buf[3],
            type: buf[4],
            msgIDResponse: buf[5],
            msgIDRequest: buf[6],
            loggerSerial: buf.readUint32LE(7),
        };

        if (result.magic !== 0xa5) {
            throw new Error("Invalid header magic: " + result.magic);
        }

        if (result.payloadLength + HEADER_LEN + FOOTER_LEN !== buf.length) {
            throw new Error("Payload length from header doesn't match packet length. Truncated?");
        }

        return result;
    }

    static parseFooter(buf) {
        const result = {
            checksum: buf[buf.length - 2],
            magic: buf[buf.length - 1] //should always be 0x15
        };

        if (result.magic !== 0x15) {
            throw new Error("Invalid footer magic: " + result.magic);
        }

        return result;
    }

    static checksum(msgBuf) {
        const slice = msgBuf.subarray(1, msgBuf.length - 2); //exclude magic bytes and checksum
        let sum = 0;

        for (let i = 0; i < slice.length; i++) {
            sum = (sum + slice[i]) & 255;
        }

        return sum & 255;
    }


    static parsePacket(buf) {
        const header = Protocol.parseHeader(buf);

        const typeStr = getKeyByValue(Protocol.MESSAGE_REQUEST_TYPES, header.type);
        if (typeStr) {
            Logger.debug(`Received packet of type "${typeStr}"`);
        } else {
            Logger.warn(`Received packet of unknown type "0x${header.type.toString(16)}"`);
        }

        return {
            header: header,
            payload: buf.subarray(HEADER_LEN, buf.length - FOOTER_LEN)
        };
    }

    static parseDataPacketPayload(packet) {
        //TODO: there's a lot more in this packet

        return {
            inverter_meta: { mppt_count : 2},
            frameType: packet.payload[0],
            sensorType: packet.payload[1],
            total_working_time: packet.payload.readUInt32BE(3),
            power_on_time: packet.payload.readUInt32BE(7),
            offset_time: packet.payload.readUInt32BE(11),
            timestamp: new Date((packet.payload.readUInt32BE(3)+packet.payload.readUInt32BE(11))*1000),          
            //10 bytes unknown,
            inverter_serial: truncateToNullTerminator(packet.payload.subarray(25, 25+10).toString("ascii")),
            //6 bytes constant unknown
            some_string: truncateToNullTerminator(packet.payload.subarray(41, 41+28).toString("ascii")),
            battery_charge_today: packet.payload.readInt16BE(41+28+(13*2))/10.0,
            battery_discharge_today: packet.payload.readInt16BE(41+28+(14*2))/10.0,
            battery_charge_total: packet.payload.readInt32BE(41+28+(15*2))/10.0,
            battery_discharge_total: packet.payload.readInt32BE(41+28+(17*2))/10.0,
            today_bought_from_grid: packet.payload.readInt16BE(41+28+(19*2))/10.0, 
            today_sold_to_grid: packet.payload.readInt16BE(41+28+(20*2))/10.0, 
            total_bought_from_grid: packet.payload.readInt32BE(41+28+(21*2))/10.0, 
            total_sold_to_grid: packet.payload.readInt32BE(41+28+(23*2))/10.0, 
            today_to_load: packet.payload.readInt16BE(41+28+(25*2))/10.0, 
            total_to_load: packet.payload.readInt32BE(41+28+(26*2))/10.0, 
            today_from_pv: packet.payload.readInt16BE(41+28+(28*2))/10.0, 
            today_from_pv1: packet.payload.readInt16BE(41+28+(29*2))/10.0, 
            today_from_pv2: packet.payload.readInt16BE(41+28+(30*2))/10.0, 
            total_from_pv: packet.payload.readInt32BE(41+28+(33*2))/10.0, 
            unkn35: packet.payload.readInt32BE(41+28+(35*2))/10.0,
            batt_temp: packet.payload.readInt16BE(41+28+(52*2))/10.0,
            batt_voltage: packet.payload.readInt16BE(41+28+(53*2))/100.0,
            batt_soc_pct: packet.payload.readInt16BE(41+28+(54*2)),
            unkn55: packet.payload.readInt16BE(41+28+(55*2)),
            batt_out_power: packet.payload.readInt16BE(41+28+(56*2)),
			batt_out_current: packet.payload.readInt16BE(41+28+(57*2))/100.0,            
            batt_corr_ah: packet.payload.readInt16BE(41+28+(58*2)),
            grid_phasea_volt: packet.payload.readInt16BE(41+28+(59*2))/10.0,
            grid_phaseb_volt: packet.payload.readInt16BE(41+28+(60*2))/10.0,
            grid_phasec_volt: packet.payload.readInt16BE(41+28+(61*2))/10.0,
            grid_phaseab_volt: packet.payload.readInt16BE(41+28+(62*2))/10.0,
            grid_phasebc_volt: packet.payload.readInt16BE(41+28+(63*2))/10.0,
            grid_phaseca_volt: packet.payload.readInt16BE(41+28+(64*2))/10.0,
            grid_phasea_power_in: packet.payload.readInt16BE(41+28+(65*2)),
            grid_phaseb_power_in: packet.payload.readInt16BE(41+28+(66*2)),
            grid_phasec_power_in: packet.payload.readInt16BE(41+28+(67*2)),
            grid_active_power_in: packet.payload.readInt16BE(41+28+(68*2)),
            grid_active_apparent_power: packet.payload.readInt16BE(41+28+(69*2)),
            grid_freq: packet.payload.readInt16BE(41+28+(70*2))/100.0,
            grid_phasea_current_in: packet.payload.readInt16BE(41+28+(71*2))/100.0,
            grid_phaseb_current_in: packet.payload.readInt16BE(41+28+(72*2))/100.0,
            grid_phasec_current_in: packet.payload.readInt16BE(41+28+(73*2))/100.0,
            grid_phasea_current_outg: packet.payload.readInt16BE(41+28+(74*2))/100.0,
            grid_phaseb_current_outg: packet.payload.readInt16BE(41+28+(75*2))/100.0,
            grid_phasec_current_outg: packet.payload.readInt16BE(41+28+(76*2))/100.0,
            grid_phasea_power_outg: packet.payload.readInt16BE(41+28+(77*2)),
            grid_phaseb_power_outg: packet.payload.readInt16BE(41+28+(78*2)),
            grid_phasec_power_outg: packet.payload.readInt16BE(41+28+(79*2)),
            grid_total_power_outg: packet.payload.readInt16BE(41+28+(80*2)),
            grid_total_apparent_power_outg: packet.payload.readInt16BE(41+28+(81*2)),
            unkn82:packet.payload.readInt16BE(41+28+(82*2)),
            grid_phasea_power: packet.payload.readInt16BE(41+28+(83*2)),
            grid_phaseb_power: packet.payload.readInt16BE(41+28+(84*2)),
            grid_phasec_power: packet.payload.readInt16BE(41+28+(85*2)),
            grid_total_power: packet.payload.readInt16BE(41+28+(86*2)),
            unkn87:packet.payload.readInt16BE(41+28+(87*2)),
            grid_phasea_volt_out: packet.payload.readInt16BE(41+28+(88*2))/10.0,
            grid_phaseb_volt_out: packet.payload.readInt16BE(41+28+(89*2))/10.0,
            grid_phasec_volt_out: packet.payload.readInt16BE(41+28+(90*2))/10.0,
            inv_phasea_current_out: packet.payload.readInt16BE(41+28+(91*2))/100.0,
            inv_phaseb_current_out: packet.payload.readInt16BE(41+28+(92*2))/100.0,
            inv_phasec_current_out: packet.payload.readInt16BE(41+28+(93*2))/100.0,
            inv_phasea_power_out: packet.payload.readInt16BE(41+28+(94*2)),
            inv_phaseb_power_out: packet.payload.readInt16BE(41+28+(95*2)),
            inv_phasec_power_out: packet.payload.readInt16BE(41+28+(96*2)),
            inv_total_power_out: packet.payload.readInt16BE(41+28+(97*2)),
            inv_total_apparent_power_outg: packet.payload.readInt16BE(41+28+(98*2)),
            inv_freq: packet.payload.readInt16BE(41+28+(99*2))/100.0,
/*            unkn100:packet.payload.readInt16BE(41+28+(100*2)),
            ups_phasea_power_out: packet.payload.readInt16BE(41+28+(101*2)),
            ups_phaseb_power_out: packet.payload.readInt16BE(41+28+(102*2)),
            ups_phasec_power_out: packet.payload.readInt16BE(41+28+(103*2)),            
            ups_total_power_out: packet.payload.readInt16BE(41+28+(104*2)),
*/            
            load_phasea_volt_out: packet.payload.readInt16BE(41+28+(100*2))/10.0,
            load_phaseb_volt_out: packet.payload.readInt16BE(41+28+(101*2))/10.0,
            load_phasec_volt_out: packet.payload.readInt16BE(41+28+(102*2))/10.0,
            load_phasea_current: packet.payload.readInt16BE(41+28+(103*2))/100.0,
            load_phaseb_current: packet.payload.readInt16BE(41+28+(104*2))/100.0,
            load_phasec_current: packet.payload.readInt16BE(41+28+(105*2))/100.0,
            load_phasea_power: packet.payload.readInt16BE(41+28+(106*2)),
            load_phaseb_power: packet.payload.readInt16BE(41+28+(107*2)),
            load_phasec_power: packet.payload.readInt16BE(41+28+(108*2)),
            load_total_power: packet.payload.readInt16BE(41+28+(109*2)),
			unkn110:packet.payload.readInt16BE(41+28+(110*2)),
			unkn111:packet.payload.readInt16BE(41+28+(111*2)),
			unkn112:packet.payload.readInt16BE(41+28+(112*2)),
			unkn113:packet.payload.readInt16BE(41+28+(113*2)),
			unkn114:packet.payload.readInt16BE(41+28+(114*2)),
			unkn115:packet.payload.readInt16BE(41+28+(115*2)),
			unkn116:packet.payload.readInt16BE(41+28+(116*2)),
			unkn117:packet.payload.readInt16BE(41+28+(117*2)),
			pv1_in_power:packet.payload.readInt16BE(41+28+(118*2)),
			pv2_in_power:packet.payload.readInt16BE(41+28+(119*2)),
			unkn120:packet.payload.readInt16BE(41+28+(120*2)),
			unkn121:packet.payload.readInt16BE(41+28+(121*2)),
			pv1_volt:packet.payload.readInt16BE(41+28+(122*2))/10.0,
			pv1_current:packet.payload.readInt16BE(41+28+(123*2))/10.0,
			pv2_volt:packet.payload.readInt16BE(41+28+(124*2))/10.0,
			pv2_current:packet.payload.readInt16BE(41+28+(125*2))/10.0,
			unkn126:packet.payload.readInt16BE(41+28+(126*2)),
			unkn127:packet.payload.readInt16BE(41+28+(127*2)),
			unkn128:packet.payload.readInt16BE(41+28+(128*2)),
			unkn129:packet.payload.readInt16BE(41+28+(129*2)),
			unkn130:packet.payload.readInt16BE(41+28+(130*2)),
			unkn131:packet.payload.readInt16BE(41+28+(131*2)),
			unkn132:packet.payload.readInt16BE(41+28+(132*2)),
			unkn133:packet.payload.readInt16BE(41+28+(133*2)),
			bms_charged_volt:packet.payload.readInt16BE(41+28+(134*2))/100.0,
			bms_discharged_volt:packet.payload.readInt16BE(41+28+(135*2))/100.0,
			bms_charge_current_limit:packet.payload.readInt16BE(41+28+(136*2)),
			bms_discharge_current_limit:packet.payload.readInt16BE(41+28+(137*2)),
			bms_battery_SOC:packet.payload.readInt16BE(41+28+(138*2)),
			bms_battery_voltage:packet.payload.readInt16BE(41+28+(139*2))/100.0,
			bms_battery_current:packet.payload.readInt16BE(41+28+(140*2)),
			bms_battery_temp:packet.payload.readInt16BE(41+28+(141*2))/10.0,
			unkn142:packet.payload.readInt16BE(41+28+(142*2)),
			unkn143:packet.payload.readInt16BE(41+28+(143*2)),
			unkn144:packet.payload.readInt16BE(41+28+(144*2)),
            //for some reason everything after byte ~120 is all BE compared to the above?
        };
    }

    static parseLoggerPacketPayload(packet) {
        //TODO: there's a lot more in this packet
        return {
            fw_ver: truncateToNullTerminator(packet.payload.subarray(19, 60).toString("ascii")),
            ip: truncateToNullTerminator(packet.payload.subarray(65, 82).toString("ascii")),
            ver: truncateToNullTerminator(packet.payload.subarray(89, 130).toString("ascii")), //hw revision maybe?
            ssid: truncateToNullTerminator(packet.payload.subarray(172, 210).toString("ascii")),
        };
    }

    static buildTimeResponse(packet) {
        const response = Buffer.alloc(23);

        // header
        response[0] = 0xa5; //magic
        response.writeUInt16LE(10, 1); //payload len
        response[3] = packet.header.unknown1;
        response[4] = packet.header.type - 0x30; // set type to response for that type
        response[5] = packet.header.msgIDResponse + 1;
        response[6] = packet.header.msgIDRequest;
        response.writeUint32LE(packet.header.loggerSerial, 7);
        // end header

        response[11] = packet.payload[0];
        response[12] = 0x01;

        response.writeUint32LE(
            Math.round(Date.now()/1000),
            13
        );
        //???
        response.writeUint32LE(
            1,
            17
        );


        response[response.length - 2] = Protocol.checksum(response);
        response[response.length - 1] = 0x15; //magic

        return response;
    }

    static parseTime(buf) {
        return new Date(
            [
                `${2000 + buf[0]}-${buf[1].toString().padStart(2, "0")}-${buf[2].toString().padStart(2, "0")}T`,
                `${buf[3].toString().padStart(2, "0")}:${buf[4].toString().padStart(2, "0")}:${buf[5].toString().padStart(2, "0")}Z`
            ].join("")
        );
    }
}

Protocol.MESSAGE_REQUEST_TYPES = {
    HANDSHAKE: 0x41,
    DATA: 0x42,
    // wifi info is 0x43?
    HEARTBEAT: 0x47,
};

Protocol.MESSAGE_RESPONSE_TYPES = {
    HANDSHAKE: 0x11,
    DATA: 0x12,
    // wifi info reply is 0x13?
    HEARTBEAT: 0x17,
};

module.exports = Protocol;
