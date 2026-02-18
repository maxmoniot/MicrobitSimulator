from microbit import *
from time import sleep_us, ticks_us, ticks_diff
from machine import time_pulse_us

CUTEBOT_ADDR = 0x10
left = 0x04
right = 0x08

class CUTEBOT(object):
    """Cutebot smart car with IR support"""

    def __init__(self):
        i2c.init()
        self.__pin_e = pin12
        self.__pin_t = pin8
        self.__pinL = pin13
        self.__pinR = pin14
        self.__pinL.set_pull(self.__pinL.PULL_UP)
        self.__pinR.set_pull(self.__pinR.PULL_UP)
        # IR receiver on P16
        self.__pin_ir = pin16
        self.__ir_code = 0

    def set_motors_speed(self, left_wheel_speed: int, right_wheel_speed: int):
        """Set left and right wheel speeds (-100 to 100)"""
        if left_wheel_speed > 100 or left_wheel_speed < -100:
            raise ValueError('speed error,-100~100')
        if right_wheel_speed > 100 or right_wheel_speed < -100:
            raise ValueError('speed error,-100~100')
        left_direction = 0x02 if left_wheel_speed > 0 else 0x01
        right_direction = 0x02 if right_wheel_speed > 0 else 0x01
        left_wheel_speed = left_wheel_speed if left_wheel_speed > 0 else left_wheel_speed * -1
        right_wheel_speed = right_wheel_speed if right_wheel_speed > 0 else right_wheel_speed * -1
        i2c.write(CUTEBOT_ADDR, bytearray(
            [0x01, left_direction, left_wheel_speed, 0]))
        i2c.write(CUTEBOT_ADDR, bytearray(
            [0x02, right_direction, right_wheel_speed, 0]))

    def set_car_light(self, light: int, R: int, G: int, B: int):
        """Set headlight color (light: 0x04=left, 0x08=right)"""
        if R > 255 or G > 255 or B > 255:
            raise ValueError('RGB is error')
        # Hardware correction: green and blue LEDs are brighter than red
        G = int(G * 0.2)
        B = int(B * 0.7)
        i2c.write(CUTEBOT_ADDR, bytearray([light, R, G, B]))

    def get_distance(self, unit: int = 0):
        """Get ultrasonic distance (unit: 0=cm, 1=inch)"""
        self.__pin_e.read_digital()
        self.__pin_t.write_digital(1)
        sleep_us(10)
        self.__pin_t.write_digital(0)
        ts = time_pulse_us(self.__pin_e, 1, 25000)
        distance = round(ts * 34 / 2 / 1000)
        if unit == 0:
            return distance
        elif unit == 1:
            return round(distance/30.48, 2)

    def get_tracking(self):
        """Get line tracking state: 0=white-white, 1=white-black, 10=black-white, 11=black-black"""
        left_val = self.__pinL.read_digital()
        right_val = self.__pinR.read_digital()
        if left_val == 1 and right_val == 1:
            return 0
        elif left_val == 0 and right_val == 1:
            return 10
        elif left_val == 1 and right_val == 0:
            return 1
        elif left_val == 0 and right_val == 0:
            return 11
        return 0

    def set_servo(self, servo, angle):
        """Set servo angle (servo: 1 or 2, angle: 0-180)"""
        if servo > 2 or servo < 1:
            raise ValueError('select servo error,1,2')
        if angle > 180 or angle < 0:
            raise ValueError('angle error,0~180')
        i2c.write(CUTEBOT_ADDR, bytearray([servo + 4, angle, 0, 0]))

    def read_ir(self):
        """
        Read IR code from remote (NEC protocol on P16).
        Returns the command byte (0-255) or 0 if no valid signal.
        Button codes: Up=64, Down=25, Left=8, Right=80, OK=28
        """
        if self.__pin_ir.read_digital() == 1:
            return 0
        
        # Count low pulse duration (start pulse ~9ms)
        count = 0
        while self.__pin_ir.read_digital() == 0 and count < 200:
            sleep_us(50)
            count += 1
        
        if count < 150:
            return 0
        
        # Count high pulse (~4.5ms for data, ~2.25ms for repeat)
        count = 0
        while self.__pin_ir.read_digital() == 1 and count < 100:
            sleep_us(50)
            count += 1
        
        if count < 70:  # Repeat code
            return self.__ir_code
        
        # Read 32 bits
        data = 0
        for _ in range(32):
            count = 0
            while self.__pin_ir.read_digital() == 0 and count < 20:
                sleep_us(50)
                count += 1
            
            count = 0
            while self.__pin_ir.read_digital() == 1 and count < 40:
                sleep_us(50)
                count += 1
            
            data = data << 1
            if count > 15:
                data |= 1
        
        command = (data >> 8) & 0xFF
        self.__ir_code = command
        return command

    def get_ir_code(self):
        """Get the last received IR code"""
        return self.__ir_code
    
    def clear_ir_code(self):
        """Clear the stored IR code"""
        self.__ir_code = 0


# Global IR reading function
_ir_last_code = 0

def read_ir():
    """
    Read IR code from P16 (NEC protocol).
    Returns command byte or 0 if no signal.
    Button codes: Up=64, Down=25, Left=8, Right=80, OK=28,
    Menu=69, Plus=70, Minus=21, Back=67, 0=22, 1=12, 2=24, 3=94,
    4=8, 5=28, 6=90, 7=66, 8=82, 9=74
    """
    global _ir_last_code
    
    if pin16.read_digital() == 1:
        return 0
    
    count = 0
    while pin16.read_digital() == 0 and count < 200:
        sleep_us(50)
        count += 1
    
    if count < 150:
        return 0
    
    count = 0
    while pin16.read_digital() == 1 and count < 100:
        sleep_us(50)
        count += 1
    
    if count < 70:
        return _ir_last_code
    
    data = 0
    for _ in range(32):
        count = 0
        while pin16.read_digital() == 0 and count < 20:
            sleep_us(50)
            count += 1
        
        count = 0
        while pin16.read_digital() == 1 and count < 40:
            sleep_us(50)
            count += 1
        
        data = data << 1
        if count > 15:
            data |= 1
    
    command = (data >> 8) & 0xFF
    _ir_last_code = command
    return command


if __name__ == '__main__':
    ct = CUTEBOT()
    display.show(Image.HAPPY)
    
    while True:
        ir = read_ir()
        if ir > 0:
            display.scroll(ir)
        sleep(50)
