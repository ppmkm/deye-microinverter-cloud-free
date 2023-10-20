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
        response.writeUint32LE(
            0,
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
