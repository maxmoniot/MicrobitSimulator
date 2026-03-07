# MFRC522 RFID Library for BBC micro:bit
# Port fidele du code TypeScript MakeCode (joy-it/pxt-rfid-mfrc522)

from microbit import *

class MFRC522:
    MI_OK = 0
    MI_NOTAGERR = 1
    MI_ERR = 2
    
    PICC_REQIDL = 0x26
    PICC_REQALL = 0x52
    PICC_ANTICOLL = 0x93
    PICC_SELECTTAG = 0x93
    PICC_AUTHENT1A = 0x60
    PICC_READ = 0x30
    PICC_WRITE = 0xA0
    PICC_HALT = 0x50
    
    PCD_IDLE = 0x00
    PCD_AUTHENT = 0x0E
    PCD_TRANSCEIVE = 0x0C
    PCD_RESETPHASE = 0x0F
    PCD_CALCCRC = 0x03
    
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
    
    BLOCK_ADDRS = [8, 9, 10]
    KEY = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
    
    def __init__(self):
        self.cs = pin16
        self.cs.write_digital(1)
        spi.init(baudrate=1000000, bits=8, mode=0, sclk=pin13, mosi=pin15, miso=pin14)
        self._buf = bytearray(1)
        self._rbuf = bytearray(1)
    
    def _spi_transfer(self, val):
        self._buf[0] = val
        spi.write_readinto(self._buf, self._rbuf)
        return self._rbuf[0]
    
    def _wreg(self, reg, val):
        self.cs.write_digital(0)
        self._spi_transfer((reg << 1) & 0x7E)
        self._spi_transfer(val)
        self.cs.write_digital(1)
    
    def _rreg(self, reg):
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
            if not (i != 0 and not (n & 0x01) and not (n & wait_irq)):
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
            if not (i != 0 and not (n & 0x04)):
                break
        
        # Ordre H, L comme dans MakeCode
        return [self._rreg(self.CRCResultRegH), self._rreg(self.CRCResultRegL)]
    
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
        if status != self.MI_OK:
            return None
        if len(recv) != 16:
            return None
        return recv
    
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
    
    def _antenna_on(self):
        val = self._rreg(self.TxControlReg)
        if not (val & 0x03):
            self._sflags(self.TxControlReg, 0x03)
    
    def _antenna_off(self):
        self._cflags(self.TxControlReg, 0x03)
    
    def _soft_reset(self):
        """Reset complet du MFRC522 sans toucher au SPI"""
        self._wreg(self.CommandReg, self.PCD_RESETPHASE)
        sleep(50)
        self._wreg(self.TModeReg, 0x8D)
        self._wreg(self.TPrescalerReg, 0x3E)
        self._wreg(self.TReloadRegL, 30)
        self._wreg(self.TReloadRegH, 0)
        self._wreg(self.TxAutoReg, 0x40)
        self._wreg(self.ModeReg, 0x3D)
        self._antenna_on()
    
    # ===== Public API =====
    
    def Init(self):
        """Initialize RFID module"""
        self._soft_reset()
    
    def getID(self):
        """Lire l ID unique de la carte"""
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
    
    def _readFromCard(self):
        """Port exact de readFromCard() du TypeScript MakeCode"""
        status, _ = self._request(self.PICC_REQIDL)
        if status != self.MI_OK:
            return None
        
        status, uid = self._anticoll()
        if status != self.MI_OK:
            return None
        
        self._select_tag(uid)
        status = self._auth(self.PICC_AUTHENT1A, 11, self.KEY, uid)
        
        data = []
        if status == self.MI_OK:
            for block in self.BLOCK_ADDRS:
                block_data = self._read_block(block)
                if block_data:
                    data += block_data
            text = ""
            if data:
                for c in data:
                    text += chr(c)
        else:
            text = None
        
        self._stop_crypto1()
        return text
    
    def read(self):
        """Lire les donnees - non bloquant comme getID()"""
        text = self._readFromCard()
        if text is not None and text.strip():
            return text.strip()
        # Si la carte a ete detectee mais la lecture a echoue,
        # une seule tentative avec soft reset
        if text is not None:
            self._soft_reset()
            text = self._readFromCard()
            if text is not None and text.strip():
                return text.strip()
        return ""
    
    def _writeToCard(self, txt):
        """Port exact de writeToCard() du TypeScript MakeCode"""
        status, _ = self._request(self.PICC_REQIDL)
        if status != self.MI_OK:
            return None
        
        status, uid = self._anticoll()
        if status != self.MI_OK:
            return None
        
        self._select_tag(uid)
        status = self._auth(self.PICC_AUTHENT1A, 11, self.KEY, uid)
        self._read_block(11)
        
        if status == self.MI_OK:
            data = []
            for i in range(len(txt)):
                data.append(ord(txt[i]))
            for j in range(len(txt), 48):
                data.append(32)
            
            b = 0
            for block in self.BLOCK_ADDRS:
                self._write_block(block, data[b*16:(b+1)*16])
                b += 1
        
        self._stop_crypto1()
        return True if status == self.MI_OK else None
    
    def write(self, text):
        """Ecrire des donnees - non bloquant"""
        txt = str(text)
        result = self._writeToCard(txt)
        if result:
            return True
        # Une seule tentative avec soft reset
        self._soft_reset()
        result = self._writeToCard(txt)
        if result:
            return True
        return False
    
    def AntennaOff(self):
        """Eteindre l antenne"""
        self._antenna_off()
