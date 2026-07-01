# Setup Help (WIP)

This website is based on a [Jupyter Book](https://jupyterbook.org/). Therefore, the page can rely on either Markdown pages or on Jupyter page.

<!-- There is several way to contribute, depending on the level of complexity --> 

To contribute, you first need to setup your computer for building a Jupyter Book. This permits the local interactive preview of the website and of your modifications.

## On Windows

### Install Python

To download the latest version of Python, go to their [website](https://www.python.org/) and use the relevant installer.

To ensure that Python is properly installed, let's check the installed version. Open a terminal (like PowerShell) :
```{code-cell} powershell
python --version
```

It should return something like :
```{code-cell} powershell
Python 3.14.5
```

If it does not work, ensure that python is added to the PATH environment variable.

### Install Jupyter Book

Create an go to your working directoy, i.e. the folder in which the website will be stored. For example, in the terminal : 
```{code-cell} powershell
cd C:\Users\cyril.douthe\WG22\ArchitecturalGeometry
```

#### Create a project environement

To avoid clashes with other python project, we are going to create a local python environment :
```{code-cell} powershell
python -m venv env
```

This will create an *env* folder in the working directory.

To activate the local environement:
```{code-cell} powershell
.\env\Scripts\activate
```

To deactivate the local environement:
```{code-cell} powershell
deactivate
```

#### Installation

In the working directory, with the environment activated, install jupyter book with :
```{code-cell} powershell
pip install "jupyter-book>=2.0.0"
```

If *pip* is not recognised, it should be added to the PATH environment variable. Otherwise, it can be called with *python -m pip*.

## Get the Source Files

The website is hosted on Github. To have it locally in the working directory, it should be cloned using Git. 


#### Cloning with Git

You should ensure that git is installed on your computer with.
```{code-cell} powershell
git --version
```

Then to clone the repository, i.e. import all the source file of the website, use :
```{code-cell} bash
git clone https://github.com/iass-wg22/architectural-geometry.git
```
or, if an SSH key is setup, prefer :
```{code-cell} bash
git clone git@github.com:iass-wg22/architectural-geometry.git
```


If you are not familiar with Git and Github and would only like to do local modification, you can go the the github [repository](https://github.com/iass-wg22/architectural-geometry), then click on *Code* and download the zip file. Unblock the zip file and then unzip it. Copy and paste all the files in the working directory.

## Run

To launch the jupyter book locally and see the live modifications of the files, run (in the working directory with an active environment):
```{code-cell} powershell
jupyter book start
```

At first launch it might ask to install node.js. Accept it,


Then click on the link provided, which should be *http://localhost:3000*. It will display cloned version of the website. 
While the jupyter book is live, you can modify the files, add new ones, etc. The website, hosted on your computer will update accordingly.

To exit in the terminal the jupyter book use *CTRL + C*.
