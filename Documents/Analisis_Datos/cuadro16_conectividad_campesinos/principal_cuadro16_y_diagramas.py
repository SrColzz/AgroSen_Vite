#------------------------------------------------------------------------------
#Importar las librerías y leer el Excel

import pandas as pd
import re
import matplotlib.pyplot as plt
import seaborn as sns


# Leer únicamente el Cuadro 16
archivo = "anex-Campesinos-ECV-2024.xlsx"

df = pd.read_excel(
    archivo,
    sheet_name="Cuadro 16",
    header=None
)

# Explorar la estructura
print("Cantidad de filas:", df.shape[0])
print("Cantidad de columnas:", df.shape[1])

print("\nPrimeras filas:")
print(df.head(20))

print("\nInformación general:")
df.info()

print("\nValores faltantes por columna:")
print(df.isnull().sum())




#------------------------------------------------------------------------------
#Extraer el resumen nacional y por área


# Posiciones de las filas en pandas
filas_resumen = [15, 16, 17]

resumen = []

for fila in filas_resumen:

    dominio = str(df.iloc[fila, 0])
    dominio = re.sub(r"\s+", " ", dominio).strip()

    resumen.append({
        "Dominio": dominio,
        "Total_hogares_miles": df.iloc[fila, 1],
        "Hogares_internet_miles": df.iloc[fila, 6],
        "Porcentaje_internet": df.iloc[fila, 10],
        "CVE_internet": df.iloc[fila, 9]
    })

df_resumen = pd.DataFrame(resumen)

# Convertir las columnas numéricas
columnas = [
    "Total_hogares_miles",
    "Hogares_internet_miles",
    "Porcentaje_internet",
    "CVE_internet"
]

df_resumen[columnas] = df_resumen[columnas].apply(
    pd.to_numeric,
    errors="coerce"
)

print(df_resumen)
print("\nDimensiones:", df_resumen.shape)

# Exportar a CSV
df_resumen.to_csv(
    "cuadro16_resumen.csv",
    index=False,
    encoding="utf-8-sig"
)




#------------------------------------------------------------------------------
#Extraer los tipos de conexión

conexiones = []

for fila in filas_resumen:

    dominio = re.sub(
        r"\s+",
        " ",
        str(df.iloc[fila, 0])
    ).strip()

    tipos = [
        ("Fija", 15, 19),
        ("Móvil", 24, 28),
        ("Fija y móvil", 33, 37)
    ]

    for tipo, col_total, col_porcentaje in tipos:

        conexiones.append({
            "Dominio": dominio,
            "Tipo_conexion": tipo,
            "Hogares_miles": df.iloc[fila, col_total],
            "Porcentaje": df.iloc[fila, col_porcentaje]
        })

df_conexiones = pd.DataFrame(conexiones)

df_conexiones["Hogares_miles"] = pd.to_numeric(
    df_conexiones["Hogares_miles"],
    errors="coerce"
)

df_conexiones["Porcentaje"] = pd.to_numeric(
    df_conexiones["Porcentaje"],
    errors="coerce"
)

print(df_conexiones)

df_conexiones.to_csv(
    "cuadro16_conexiones.csv",
    index=False,
    encoding="utf-8-sig"
)




#------------------------------------------------------------------------------
#Extraer los datos departamentales

departamentos = []

# Filas 19 a 51 de Excel; índices 18 a 50 en pandas
for fila in range(18, 51):

    nombre = str(df.iloc[fila, 0])
    nombre = re.sub(r"\s+", " ", nombre).strip()

    departamentos.append({
        "Departamento": nombre,
        "Total_hogares_miles": df.iloc[fila, 1],
        "Hogares_internet_miles": df.iloc[fila, 6],
        "Porcentaje_internet": df.iloc[fila, 10],
        "CVE_internet": df.iloc[fila, 9]
    })

df_departamentos = pd.DataFrame(departamentos)

for columna in [
    "Total_hogares_miles",
    "Hogares_internet_miles",
    "Porcentaje_internet",
    "CVE_internet"
]:
    df_departamentos[columna] = pd.to_numeric(
        df_departamentos[columna],
        errors="coerce"
    )

print(df_departamentos.shape)
print(df_departamentos.head())

df_departamentos.to_csv(
    "cuadro16_departamentos.csv",
    index=False,
    encoding="utf-8-sig"
)


#------------------------------------------------------------------------------
#Leer los CSV con pd.read_csv()

# Leer los archivos limpios
df_resumen = pd.read_csv(
    "cuadro16_resumen.csv",
    sep=","
)

df_conexiones = pd.read_csv(
    "cuadro16_conexiones.csv",
    sep=","
)

df_departamentos = pd.read_csv(
    "cuadro16_departamentos.csv",
    sep=","
)



#------------------------------------------------------------------------------
#Gráfica 1. Comparación del acceso a internet

sns.set_theme(style="whitegrid")

# Excluir el total nacional para comparar áreas
comparacion = df_resumen[
    df_resumen["Dominio"] != "Total nacional"
].copy()

plt.figure(figsize=(10, 6))

ax = sns.barplot(
    data=comparacion,
    x="Dominio",
    y="Porcentaje_internet"
)

plt.title(
    "Acceso a internet en hogares campesinos por área (2024)"
)
plt.xlabel("Área geográfica")
plt.ylabel("Hogares con acceso a internet (%)")
plt.ylim(0, 100)

for container in ax.containers:
    ax.bar_label(container, fmt="%.1f%%", padding=3)

plt.tight_layout()
plt.savefig("grafica_1_acceso_por_area.png", dpi=300)
plt.show()



#------------------------------------------------------------------------------
#Gráfica 2. Tipos de conexión a internet

plt.figure(figsize=(11, 6))

sns.barplot(
    data=df_conexiones[
        df_conexiones["Dominio"] != "Total nacional"
    ],
    x="Tipo_conexion",
    y="Porcentaje",
    hue="Dominio"
)

plt.title(
    "Tipos de conexión de los hogares campesinos con internet"
)
plt.xlabel("Tipo de conexión")
plt.ylabel("Porcentaje (%)")
plt.tight_layout()

plt.savefig("grafica_2_tipos_conexion.png", dpi=300)
plt.show()



#------------------------------------------------------------------------------
#Gráfica 3. Acceso a internet por departamento

departamentos_validos = df_departamentos[
    (df_departamentos["CVE_internet"] <= 10) &
    (df_departamentos["Porcentaje_internet"].notna())
].copy()

departamentos_validos = departamentos_validos.sort_values(
    "Porcentaje_internet",
    ascending=True
)

plt.figure(figsize=(10, 10))

sns.barplot(
    data=departamentos_validos,
    x="Porcentaje_internet",
    y="Departamento"
)

plt.title(
    "Acceso a internet en hogares campesinos por departamento"
)
plt.xlabel("Hogares con acceso a internet (%)")
plt.ylabel("Departamento")
plt.tight_layout()

plt.savefig("grafica_3_acceso_departamental.png", dpi=300)
plt.show()


