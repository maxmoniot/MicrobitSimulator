# MFRC522 RFID Library for BBC micro:bit
# Port du code TypeScript MakeCode (joy-it/pxt-rfid-mfrc522)
# Version corrigee - pins SPI identiques a MakeCode:
# spiPins(P15, P14, P13) => MOSI=P15, MISO=P14, SCK=P13
# CS/NSS=P16

from microbit import *

class MFRC522:
    # Status codes
    MI_OK = 0
    MI_NOTAGERR = 1
    MI_ERR = 2
    
    # PICC commands
    PICC_REQIDL = 0x26
    PICC_REQALL = 0x52
    PICC_ANTICOLL = 0x93
    PICC_SELECTTAG = 0x93
    PICC_AUTHENT1A = 0x60
    PICC_AUTHENT1B = 0x61
    PICC_READ = 0x30
    PICC_WRITE = 0xA0
    PICC_HALT = 0x50
    
    # PCD commands
    PCD_IDLE = 0x00
    PCD_AUTHENT = 0x0E
    PCD_TRANSCEIVE = 0x0C
    PCD_RESETPHASE = 0x0F
    PCD_CALCCRC = 0x03
    
    # Registers
    CommandReg = 0x01
    CommIEnReg = 0x02
    DivIEnReg = 0x03
    CommIrqReg = 0x04
    DivIrqReg = 0x05
    ErrorReg = 0x06
    Status2Reg = 0x08
    FIFODataReg = 0x09
    FIFOLevelReg = 0x0A
    ControlReg = 0x0C
    BitFramingReg = 0x0D
    ModeReg = 0x11
    TxControlReg = 0x14
    TxAutoReg = 0x15
    CRCResultRegL = 0x21
    CRCResultRegH = 0x22
    TModeReg = 0x2A
    TPrescalerReg = 0x2B
    TReloadRegH = 0x2C
    TReloadRegL = 0x2D
    
    def __init__(self):
        self.cs = pin16
        self.cs.write_digital(1)
        # IMPORTANT: Configuration SPI identique a MakeCode
        # MakeCode: pins.spiPins(DigitalPin.P15, DigitalPin.P14, DigitalPin.P13)
        # => MOSI=P15, MISO=P14, SCK=P13
        # MakeCode: pins.spiFormat(8, 3) => mode 3 (CPOL=1, CPHA=1)
        # MakeCode: pins.spiFrequency(1000000) => 1MHz
        spi.init(baudrate=1000000, bits=8, mode=3, sclk=pin13, mosi=pin15, miso=pin14)
        # Buffer pour les transferts SPI
        self._buf = bytearray(1)
        self._rbuf = bytearray(1)
    
    def _spi_transfer(self, val):
        """Transfert SPI d'un octet - equivalent a pins.spiWrite()"""
        self._buf[0] = val
        spi.write_readinto(self._buf, self._rbuf)
        return self._rbuf[0]
    
    def _wreg(self, reg, val):
        """Ecriture registre - Write_MFRC522"""
        self.cs.write_digital(0)
        self._spi_transfer((reg << 1) & 0x7E)
        self._spi_transfer(val)
        self.cs.write_digital(1)
    
    def _rreg(self, reg):
        """Lecture registre - Read_MFRC522"""
        self.cs.write_digital(0)
        self._spi_transfer(((reg << 1) & 0x7E) | 0x80)
        val = self._spi_transfer(0)
        self.cs.write_digital(1)
        return val
    
    def _sflags(self, reg, mask):
        self._wreg(reg, self._rreg(reg) | mask)
    
    def _cflags(self, reg, mask):
        self._wreg(reg, self._rreg(reg) & (~mask))
    
    def _tocard(self, cmd, data):
        recv = []
        bits = 0
        status = self.MI_ERR
        irq_en = 0x00
        wait_irq = 0x00
        
        if cmd == self.PCD_AUTHENT:
            irq_en = 0x12
            wait_irq = 0x10
        elif cmd == self.PCD_TRANSCEIVE:
            irq_en = 0x77
            wait_irq = 0x30
        
        self._wreg(self.CommIEnReg, irq_en | 0x80)
        self._cflags(self.CommIrqReg, 0x80)
        self._sflags(self.FIFOLevelReg, 0x80)
        self._wreg(self.CommandReg, self.PCD_IDLE)
        
        for b in data:
            self._wreg(self.FIFODataReg, b)
        
        self._wreg(self.CommandReg, cmd)
        
        if cmd == self.PCD_TRANSCEIVE:
            self._sflags(self.BitFramingReg, 0x80)
        
        i = 2000
        while True:
            n = self._rreg(self.CommIrqReg)
            i -= 1
            if (i == 0) or (n & 0x01) or (n & wait_irq):
                break
        
        self._cflags(self.BitFramingReg, 0x80)
        
        if i != 0:
            err = self._rreg(self.ErrorReg)
            if (err & 0x1B) == 0x00:
                status = self.MI_OK
                
                if n & irq_en & 0x01:
                    status = self.MI_NOTAGERR
                elif cmd == self.PCD_TRANSCEIVE:
                    n = self._rreg(self.FIFOLevelReg)
                    last_bits = self._rreg(self.ControlReg) & 0x07
                    if last_bits != 0:
                        bits = (n - 1) * 8 + last_bits
                    else:
                        bits = n * 8
                    
                    if n == 0:
                        n = 1
                    elif n > 16:
                        n = 16
                    
                    for _ in range(n):
                        recv.append(self._rreg(self.FIFODataReg))
            else:
                status = self.MI_ERR
        
        return status, recv, bits
    
    def _crc(self, data):
        self._cflags(self.DivIrqReg, 0x04)
        self._sflags(self.FIFOLevelReg, 0x80)
        
        for b in data:
            self._wreg(self.FIFODataReg, b)
        
        self._wreg(self.CommandReg, self.PCD_CALCCRC)
        
        i = 0xFF
        while True:
            n = self._rreg(self.DivIrqReg)
            i -= 1
            if (i == 0) or (n & 0x04):
                break
        
        return [self._rreg(self.CRCResultRegL), self._rreg(self.CRCResultRegH)]
    
    def _reset(self):
        self._wreg(self.CommandReg, self.PCD_RESETPHASE)
    
    def _antenna_on(self):
        val = self._rreg(self.TxControlReg)
        if (val & 0x03) != 0x03:
            self._sflags(self.TxControlReg, 0x03)
    
    def _antenna_off(self):
        self._cflags(self.TxControlReg, 0x03)
    
    def _request(self, mode):
        self._wreg(self.BitFramingReg, 0x07)
        status, recv, bits = self._tocard(self.PCD_TRANSCEIVE, [mode])
        if status != self.MI_OK or bits != 0x10:
            status = self.MI_ERR
        return status, bits
    
    def _anticoll(self):
        ser_chk = 0
        self._wreg(self.BitFramingReg, 0x00)
        
        status, recv, bits = self._tocard(self.PCD_TRANSCEIVE, [self.PICC_ANTICOLL, 0x20])
        
        if status == self.MI_OK:
            if len(recv) == 5:
                for i in range(4):
                    ser_chk = ser_chk ^ recv[i]
                if ser_chk != recv[4]:
                    status = self.MI_ERR
            else:
                status = self.MI_ERR
        
        return status, recv
    
    def _select_tag(self, uid):
        buf = [self.PICC_SELECTTAG, 0x70] + uid[:5]
        buf += self._crc(buf)
        status, recv, bits = self._tocard(self.PCD_TRANSCEIVE, buf)
        return self.MI_OK if (status == self.MI_OK and bits == 0x18) else self.MI_ERR
    
    def _auth(self, mode, addr, key, uid):
        return self._tocard(self.PCD_AUTHENT, [mode, addr] + key + uid[:4])[0]
    
    def _stop_crypto1(self):
        self._cflags(self.Status2Reg, 0x08)
    
    def _read_block(self, addr):
        buf = [self.PICC_READ, addr]
        buf += self._crc(buf)
        status, recv, _ = self._tocard(self.PCD_TRANSCEIVE, buf)
        return recv if status == self.MI_OK else None
    
    def _write_block(self, addr, data):
        buf = [self.PICC_WRITE, addr]
        buf += self._crc(buf)
        status, recv, bits = self._tocard(self.PCD_TRANSCEIVE, buf)
        
        if status != self.MI_OK or bits != 4 or (recv[0] & 0x0F) != 0x0A:
            return self.MI_ERR
        
        buf = list(data[:16])
        while len(buf) < 16:
            buf.append(0)
        buf += self._crc(buf)
        
        status, recv, bits = self._tocard(self.PCD_TRANSCEIVE, buf)
        if status != self.MI_OK or bits != 4 or (recv[0] & 0x0F) != 0x0A:
            return self.MI_ERR
        
        return self.MI_OK
    
    # ===== Public API (comme MakeCode) =====
    
    def Init(self):
        """Initialize RFID module - MFRC522.Init()"""
        self._reset()
        sleep(50)
        
        self._wreg(self.TModeReg, 0x8D)
        self._wreg(self.TPrescalerReg, 0x3E)
        self._wreg(self.TReloadRegL, 30)
        self._wreg(self.TReloadRegH, 0)
        self._wreg(self.TxAutoReg, 0x40)
        self._wreg(self.ModeReg, 0x3D)
        
        self._antenna_on()
    
    def getID(self):
        """Get card UID as number - MFRC522.getID()"""
        status, _ = self._request(self.PICC_REQIDL)
        if status != self.MI_OK:
            return 0
        
        status, uid = self._anticoll()
        if status != self.MI_OK:
            return 0
        
        uid_int = 0
        for i in range(4):
            uid_int = (uid_int << 8) | uid[i]
        
        self._stop_crypto1()
        return uid_int
    
    def read(self):
        """Read data from card - MFRC522.read()"""
        key = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
        
        status, _ = self._request(self.PICC_REQIDL)
        if status != self.MI_OK:
            return ""
        
        status, uid = self._anticoll()
        if status != self.MI_OK:
            return ""
        
        if self._select_tag(uid) != self.MI_OK:
            return ""
        
        if self._auth(self.PICC_AUTHENT1A, 4, key, uid) == self.MI_OK:
            data = self._read_block(4)
            self._stop_crypto1()
            if data:
                result = ""
                for b in data:
                    if b == 0:
                        break
                    if 32 <= b < 127:
                        result += chr(b)
                return result
        
        self._stop_crypto1()
        return ""
    
    def write(self, text):
        """Write data to card - MFRC522.write()"""
        key = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
        
        status, _ = self._request(self.PICC_REQIDL)
        if status != self.MI_OK:
            return False
        
        status, uid = self._anticoll()
        if status != self.MI_OK:
            return False
        
        if self._select_tag(uid) != self.MI_OK:
            return False
        
        if self._auth(self.PICC_AUTHENT1A, 4, key, uid) == self.MI_OK:
            data = [ord(c) for c in str(text)[:16]]
            while len(data) < 16:
                data.append(0)
            status = self._write_block(4, data)
            self._stop_crypto1()
            return status == self.MI_OK
        
        self._stop_crypto1()
        return False
    
    def AntennaOff(self):
        """Turn antenna off - MFRC522.AntennaOff()"""
        self._antenna_off()
