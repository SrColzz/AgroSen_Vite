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



import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# Carga y filtrado de datos departamentales (n = 32 departamentos válidos)
df_dept = pd.read_csv("cuadro16_departamentos.csv", encoding="utf-8-sig")
df_dept_clean = df_dept.drop(index=26).reset_index(drop=True)

# Definición de variables predictora (X) y respuesta (y)
X = df_dept_clean[["Total_hogares_miles"]]
y = df_dept_clean["Hogares_internet_miles"]

# Entrenamiento del modelo de Regresión Lineal
modelo_lr = LinearRegression()
modelo_lr.fit(X, y)

# Predicciones y métricas de evaluación
y_pred = modelo_lr.predict(X)
pendiente = modelo_lr.coef_[0]
intercepto = modelo_lr.intercept_
r2 = r2_score(y, y_pred)
rmse = np.sqrt(mean_squared_error(y, y_pred))

print("=== PARÁMETROS DEL MODELO DE REGRESIÓN LINEAL ===")
print(f"Pendiente (m / beta_1): {pendiente:.4f}")
print(f"Intercepto (b / beta_0): {intercepto:.4f}")
print(f"Ecuación: y = {pendiente:.4f} * X + ({intercepto:.4f})")
print(f"Coeficiente de Determinación (R^2): {r2:.4f}")
print(f"Error Cuadrático Medio (RMSE): {rmse:.4f} mil hogares")

import matplotlib.pyplot as plt

plt.figure(figsize=(8, 5))
plt.scatter(
    X,
    y,
    color='#2b5c8f',
    label='Datos reales departamentales',
    alpha=0.8,
    s=50,
)
plt.plot(
    X,
    y_pred,
    color='#e74c3c',
    linewidth=2,
    label=f'Línea de Regresión: y = {pendiente:.2f}x + ({intercepto:.2f})',
)
plt.title(
    'Modelo de Regresión Lineal: Hogares Campesinos vs Hogares con Internet',
    fontsize=12,
    fontweight='bold',
)
plt.xlabel('Total Hogares Campesinos (Miles)', fontsize=10)
plt.ylabel('Hogares Campesinos con Internet (Miles)', fontsize=10)
plt.legend()
plt.tight_layout()
plt.savefig('model_regresion_lineal.png', dpi=300)



import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.cluster import KMeans

# Definición de variables para la clusterización
X_cluster = df_dept_clean[['Total_hogares_miles', 'Porcentaje_internet']]

# Configuración y entrenamiento de K-Means con K=3
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
df_dept_clean['Cluster_Id'] = kmeans.fit_predict(X_cluster)

# Mapeo y caracterización de los Clústeres ordenados por volumen poblacional
resumen_clusters = df_dept_clean.groupby('Cluster_Id').agg({
    'Total_hogares_miles': 'mean',
    'Hogares_internet_miles': 'mean',
    'Porcentaje_internet': 'mean',
    'Departamento': 'count'
}).rename(columns={'Departamento': 'Cant_Departamentos'}).reset_index()

print("=== CENTROIDES Y CARACTERIZACIÓN DE CLÚSTERES ===")
print(resumen_clusters)


# Mapeo de nombres ejecutivos a los clústeres según volumen poblacional
nombres_cluster = {
    0: 'Clúster 1: Escala Pequeña/Periférica',
    2: 'Clúster 2: Escala Intermedia',
    1: 'Clúster 3: Escala Masiva/Poblada',
}
df_dept_clean['Segmento_AgroSen'] = df_dept_clean['Cluster_Id'].map(
    nombres_cluster
)

plt.figure(figsize=(9, 6))
sns.scatterplot(
    data=df_dept_clean,
    x='Total_hogares_miles',
    y='Porcentaje_internet',
    hue='Segmento_AgroSen',
    palette='Set1',
    style='Segmento_AgroSen',
    s=100,
)
plt.title(
    'Modelo de Clusterización K-Means (Segmentación Territorial AgroSen)',
    fontsize=12,
    fontweight='bold',
)
plt.xlabel('Total Hogares Campesinos (Miles)', fontsize=10)
plt.ylabel('Porcentaje de Acceso a Internet (%)', fontsize=10)
plt.legend(title='Segmento Territorial', loc='lower right')
plt.tight_layout()
plt.savefig('model_clusterizacion.png', dpi=300)