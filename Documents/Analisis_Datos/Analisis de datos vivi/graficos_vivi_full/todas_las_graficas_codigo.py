# Código Python para la generación del gráfico de barras verticales
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import numpy as np

resumen = pd.read_csv("cuadro16_resumen.csv")
sns.set_theme(style="whitegrid")

plt.figure(figsize=(8, 5))
ax = sns.barplot(
    data=resumen[resumen["Dominio"] != "Total nacional"],
    x="Dominio",
    y="Porcentaje_internet",
    palette="Blues_d",
)
plt.title(
    "Porcentaje de Acceso a Internet en Hogares Campesinos por Área (2024)",
    fontsize=12,
    fontweight="bold",
)
plt.xlabel("Área Geográfica", fontsize=10)
plt.ylabel("Porcentaje con Acceso (%)", fontsize=10)
plt.ylim(0, 70)

for p in ax.patches:
  ax.annotate(
      f"{p.get_height():.1f}%",
      (p.get_x() + p.get_width() / 2.0, p.get_height()),
      ha="center",
      va="bottom",
      fontsize=10,
      xytext=(0, 3),
      textcoords="offset points",
  )

plt.tight_layout()
plt.savefig("eda_barras_verticales.png", dpi=300)



# Código Python para el gráfico de barras horizontales
dept_clean = pd.read_csv("cuadro16_departamentos.csv").drop(index=26)
dept_sorted = dept_clean.sort_values(by="Porcentaje_internet", ascending=False)
top_bottom = pd.concat([dept_sorted.head(5), dept_sorted.tail(5)])

plt.figure(figsize=(10, 6))
ax = sns.barplot(
    data=top_bottom,
    y="Departamento",
    x="Porcentaje_internet",
    palette="viridis",
)
plt.title(
    "Departamentos con Mayor y Menor Cobertura de Internet Campesina (%)",
    fontsize=12,
    fontweight="bold",
)
plt.xlabel("Porcentaje de Acceso a Internet (%)", fontsize=10)
plt.ylabel("Departamento", fontsize=10)

for p in ax.patches:
  ax.annotate(
      f"{p.get_width():.1f}%",
      (p.get_width(), p.get_y() + p.get_height() / 2.0),
      ha="left",
      va="center",
      fontsize=9,
      xytext=(5, 0),
      textcoords="offset points",
  )

plt.xlim(0, 90)
plt.tight_layout()
plt.savefig("eda_barras_horizontales.png", dpi=300)


# Código Python para el gráfico de barras agrupadas
conexiones = pd.read_csv("cuadro16_conexiones.csv")

plt.figure(figsize=(9, 5))
ax = sns.barplot(
    data=conexiones,
    x="Tipo_conexion",
    y="Porcentaje",
    hue="Dominio",
    palette="Set2",
)
plt.title(
    "Tipos de Conexión en Hogares Campesinos según Área",
    fontsize=12,
    fontweight="bold",
)
plt.xlabel("Modalidad de Conexión", fontsize=10)
plt.ylabel("Porcentaje del Total de Conectados (%)", fontsize=10)
plt.ylim(0, 90)

for p in ax.patches:
  height = p.get_height()
  if not np.isnan(height) and height > 0:
    ax.annotate(
        f"{height:.1f}%",
        (p.get_x() + p.get_width() / 2.0, height),
        ha="center",
        va="bottom",
        fontsize=9,
        xytext=(0, 3),
        textcoords="offset points",
    )

plt.tight_layout()
plt.savefig("eda_barras_agrupadas.png", dpi=300)



# Código Python para el gráfico de pie
conex_nac = conexiones[conexiones["Dominio"] == "Total nacional"]

plt.figure(figsize=(7, 7))
plt.pie(
    conex_nac["Hogares_miles"],
    labels=conex_nac["Tipo_conexion"],
    autopct="%1.1f%%",
    startangle=140,
    colors=["#66c2a5", "#fc8d62", "#8da0cb"],
    explode=(0.03, 0.03, 0.03),
)
plt.title(
    "Distribución Nacional de Hogares Campesinos por Tipo de Conexión (Miles)",
    fontsize=12,
    fontweight="bold",
)
plt.tight_layout()
plt.savefig("eda_pie_conexion.png", dpi=300)



# Código Python para el Histograma con KDE
plt.figure(figsize=(8, 5))
sns.histplot(dept_clean['Porcentaje_internet'], kde=True, bins=8, color='#3498db')
plt.title('Histograma de Distribución de Cobertura de Internet Departamental', fontsize=12, fontweight='bold')
plt.xlabel('Porcentaje de Acceso a Internet (%)', fontsize=10)
plt.ylabel('Frecuencia (N° de Departamentos)', fontsize=10)
plt.tight_layout()
plt.savefig('eda_histograma.png', dpi=300)



# Código Python para el Gráfico de Dispersión
plt.figure(figsize=(8, 5))
sns.scatterplot(
    data=dept_clean,
    x='Total_hogares_miles',
    y='Hogares_internet_miles',
    hue='Porcentaje_internet',
    palette='crest',
    size='Porcentaje_internet',
    sizes=(40, 200),
)
plt.title(
    'Relación entre Total de Hogares Campesinos y Hogares con Internet',
    fontsize=12,
    fontweight='bold',
)
plt.xlabel('Total Hogares Campesinos (Miles)', fontsize=10)
plt.ylabel('Hogares Campesinos con Internet (Miles)', fontsize=10)
plt.tight_layout()
plt.savefig('eda_dispersion.png', dpi=300)


# Código Python para el Mapa de Calor
plt.figure(figsize=(7, 5))
corr = dept_clean[[
    'Total_hogares_miles',
    'Hogares_internet_miles',
    'Porcentaje_internet',
    'CVE_internet',
]].corr()
sns.heatmap(
    corr,
    annot=True,
    cmap='coolwarm',
    vmin=-1,
    vmax=1,
    fmt='.2f',
    linewidths=0.5,
)
plt.title(
    'Mapa de Calor - Matriz de Correlación de Variables Departamentales',
    fontsize=12,
    fontweight='bold',
)
plt.tight_layout()
plt.savefig('eda_heatmap_correlacion.png', dpi=300)


# Código Python para la Matriz de Dispersión (Pairplot)
g = sns.pairplot(
    dept_clean[[
        "Total_hogares_miles",
        "Hogares_internet_miles",
        "Porcentaje_internet",
    ]],
    diag_kind="kde",
    corner=True,
)
g.fig.suptitle(
    "Matriz de Dispersión (Pairplot) de Variables Cuantitativas",
    y=1.02,
    fontsize=12,
    fontweight="bold",
)
plt.tight_layout()
plt.savefig("eda_matriz_dispersion.png", dpi=300)



