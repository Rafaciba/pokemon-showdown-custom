"""
Gera o sprite do mato alto da Expedição (assets/sprites/trainers-custom/expeditiongrass.png).

Usado como "avatar" do lado dos Pokémon selvagens na batalha, no lugar de um sprite de
treinador (pedido do usuário, 2026-10-21). Arte própria, desenhada por código em pixel
art (40x40 ampliado para 80x80, o tamanho dos sprites de treinador do PS), sem
dependências: o PNG é montado à mão com zlib.

Uso (na raiz): python scripts/sprites/mato.py
"""
import os
import struct
import zlib

SIZE = 40
SCALE = 2
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sprites', 'trainers-custom', 'expeditiongrass.png')

# Paletas: contorno, sombra, meio, claro, brilho (fileira de trás mais escura)
BACK = [(24, 72, 32), (40, 104, 48), (56, 136, 64), (80, 168, 80), (112, 192, 96)]
FRONT = [(24, 80, 32), (48, 128, 48), (72, 168, 56), (112, 200, 72), (168, 232, 112)]


def blade(base_left, base_right, tip_x, tip_y, bottom):
    """Pixels de uma folha: triângulo da base (bottom) até a ponta."""
    pixels = set()
    for y in range(tip_y, bottom + 1):
        t = (y - tip_y) / max(1, bottom - tip_y)
        left = tip_x + (base_left - tip_x) * t
        right = tip_x + (base_right - tip_x) * t
        for x in range(int(round(left)), int(round(right)) + 1):
            pixels.add((x, y))
    return pixels


def tuft(cx, bottom, height, width):
    """Tufo de três folhas pontudas (a do meio mais alta), como o mato alto dos jogos."""
    blades = []
    for offset, h, lean in ((-0.32, 0.78, -3), (0, 1.0, 0), (0.32, 0.78, 3)):
        base = cx + offset * width
        blades.append(blade(base - width * 0.26, base + width * 0.26, base + lean, bottom - int(height * h), bottom))
    return blades


def paint(canvas, blades, palette, bottom, top):
    union = set().union(*blades)
    for index, pixels in enumerate(blades):
        for (x, y) in pixels:
            if not (0 <= x < SIZE and 0 <= y < SIZE):
                continue
            outside = any((x + dx, y + dy) not in union for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if outside:
                canvas[y][x] = palette[0]
                continue
            # Linha de sombra entre as folhas do tufo (borda da folha dentro do tufo)
            inner = any((x + dx, y + dy) not in pixels for dx, dy in ((1, 0), (-1, 0)))
            if inner and index != 1:
                canvas[y][x] = palette[1]
                continue
            # Mais claro no alto (luz de cima); a folha do meio, mais clara
            t = (y - top) / max(1, bottom - top)
            shade = 4 if t < 0.25 else 3 if t < 0.55 else 2
            if index == 1 and shade < 4:
                shade += 1
            canvas[y][x] = palette[shade]


def main():
    canvas = [[None] * SIZE for _ in range(SIZE)]
    # Fileira de trás (mais escura e baixa), depois a da frente por cima, desencontradas
    for cx in (1, 20, 39):
        paint(canvas, tuft(cx, 33, 20, 16), BACK, 33, 13)
    for cx in (10, 30):
        paint(canvas, tuft(cx, 39, 30, 18), FRONT, 39, 9)
    rows = []
    for y in range(SIZE * SCALE):
        row = bytearray([0])
        for x in range(SIZE * SCALE):
            color = canvas[y // SCALE][x // SCALE]
            row += bytes(color + (255,)) if color else bytes((0, 0, 0, 0))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE * SCALE, SIZE * SCALE, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(png)
    print(os.path.normpath(OUT))


main()
